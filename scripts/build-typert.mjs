import { cp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import {
  WorkspaceAnalyzer,
  FaceModelEmitter,
} from "@deepseek-ai/dsh-typert-generator";

// 官方分析器只扫描 packages/ 下的项目；用隔离副本复用完整校验，
// 不修改源码结构，也不依赖开发机的官方仓库检出。
const root = resolve(".local/typert-build");
const boundary = relative(resolve(".local"), root);
if (!boundary || boundary.startsWith("..") || isAbsolute(boundary))
  throw new Error("Typert 临时目录超出工作区");
await rm(root, { recursive: true, force: true });
const pkg = resolve(root, "packages/cursor-agent");
await mkdir(pkg, { recursive: true });
await cp("src/host", resolve(pkg, "src/host"), { recursive: true });
await cp("src/shared", resolve(pkg, "src/shared"), { recursive: true });
// 宿主可信cwd解析只依赖这一安全错误类型，不把模型运行实现纳入RPC分析。
await mkdir(resolve(pkg, "src/adapter"), { recursive: true });
await cp("src/adapter/errors.ts", resolve(pkg, "src/adapter/errors.ts"));
await writeFile(
  resolve(pkg, "src/index.ts"),
  'export { CursorAccountService } from "./host/remote-service.js";\nexport type { AccountState, AccountModel } from "./shared/account.js";\n',
);
const original = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  resolve(pkg, "package.json"),
  JSON.stringify({
    ...original,
    exports: {
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./shared/account": {
        types: "./lib/types/shared/account.d.ts",
        default: "./lib/shared/account.js",
      },
    },
  }),
);
const protocol = resolve(root, "packages/protocol");
await cp("node_modules/@deepseek-ai/dsh-typert-protocol", protocol, {
  recursive: true,
});
await writeFile(
  resolve(protocol, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: { skipLibCheck: true },
    include: ["lib/types/**/*.d.ts"],
  }),
);
await mkdir(resolve(protocol, "src"), { recursive: true });
for (const file of await readdir(resolve(protocol, "lib/types"))) {
  if (file.endsWith(".d.ts"))
    await cp(
      resolve(protocol, "lib/types", file),
      resolve(protocol, "src", file.replace(/\.d\.ts$/, ".ts")),
    );
}
const config = JSON.parse(await readFile("tsconfig.json", "utf8"));
await writeFile(
  resolve(pkg, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      ...config.compilerOptions,
      types: ["node"],
      paths: {
        "@deepseek-ai/dsh-typert-protocol": [resolve(protocol, "src/index.ts")],
      },
    },
    include: ["src/**/*.ts"],
  }),
);
await writeFile(
  resolve(root, "tsconfig.host.json"),
  JSON.stringify({
    compilerOptions: {
      ...config.compilerOptions,
      paths: {
        "@deepseek-ai/dsh-typert-protocol": [resolve(protocol, "src/index.ts")],
      },
    },
    files: [],
    references: [
      { path: "./packages/cursor-agent" },
      { path: "./packages/protocol" },
    ],
  }),
);
const model = new WorkspaceAnalyzer({
  root,
  faces: ["host"],
  packages: [original.name],
  checkDiagnostics: true,
}).analyze();
const host = model.faces.find((face) => face.face === "host");
if (!host) throw new Error("Typert 未生成宿主模型");
const result = new FaceModelEmitter(host).emit(original.name);
if (!result.remote) throw new Error("Typert 未发现 Cursor 账号远程方法");
await mkdir("lib", { recursive: true });
const finalNewline = (text) => `${text.trimEnd()}\n`;
await writeFile("lib/typert.host.js", finalNewline(result.js));
await writeFile("lib/typert.host.d.ts", finalNewline(result.dts));
await writeFile("lib/typert.remote-client.js", finalNewline(result.remote.js));
await writeFile(
  "lib/typert.remote-client.d.ts",
  finalNewline(result.remote.dts.replace(/^\/\/# sourceMappingURL=.*$/m, "")),
);
