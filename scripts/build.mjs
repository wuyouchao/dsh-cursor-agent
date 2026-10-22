import "./build-typert.mjs";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"],
  { stdio: "inherit" },
);
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const external = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@deepseek-ai/cordis",
  "zod",
  "@tanstack/react-virtual",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/dsh-client-ui-dockkit",
];
await build({
  entryPoints: ["src/client/index.ts"],
  outfile: "dist/client.js",
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: "es2023",
  sourcemap: true,
  external,
  define: { "process.env.NODE_ENV": '"production"' },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: "return module.exports; } });" },
});
