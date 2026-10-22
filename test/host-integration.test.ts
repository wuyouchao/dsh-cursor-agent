import assert from "node:assert/strict";
import test from "node:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import Group from "@deepseek-ai/cordis-plugin-group";
import {
  PluginPackages,
  createRuntimeResolution,
  type Profile,
} from "@deepseek-ai/dsh-app-boot";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import SessionStore from "@deepseek-ai/dsh-session";
import ProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import LlmRuntime from "@deepseek-ai/dsh-llm";
import ToolRuntime from "@deepseek-ai/dsh-tools";
import AgentPresets from "@deepseek-ai/dsh-agent-preset-registry";
import * as Persona from "@deepseek-ai/dsh-persona";
import * as HostScope from "@deepseek-ai/dsh-scope";
import HostSystemPrompt from "@deepseek-ai/dsh-system-prompt";

/** 两个真正物理依赖树，使用官方profile resolver；绝不借用用户profile。 */
for (const shadow of [true, false]) {
  test(`Host真实解析与预设挂载：${shadow ? "旧生产依赖shadow复现作用域失认" : "peer-only复用Host作用域"}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-host-peer-"));
    const profileDir = join(root, "profiles", shadow ? "old" : "fixed");
    const modules = join(profileDir, "node_modules");
    const entry = join(modules, "profile-probe", "index.js");
    const ctx = new Context();
    try {
      await mkdir(dirname(entry), { recursive: true });
      await writeFile(
        join(dirname(entry), "package.json"),
        JSON.stringify({
          name: "profile-probe",
          version: "1.0.0",
          type: "module",
          main: "index.js",
        }),
      );
      await writeFile(
        entry,
        'export * as scope from "@deepseek-ai/dsh-scope"; export { default as SystemPrompt } from "@deepseek-ai/dsh-system-prompt";',
      );
      const dependencies: Record<string, string> = { "profile-probe": "1.0.0" };
      if (shadow) {
        for (const name of [
          "@deepseek-ai/dsh-scope",
          "@deepseek-ai/dsh-system-prompt",
        ]) {
          const source = dirname(
            fileURLToPath(import.meta.resolve(`${name}/package.json`)),
          );
          await cp(source, join(modules, name), { recursive: true });
          dependencies[name] = "0.2.1-rc.2";
        }
      }
      await writeFile(
        join(profileDir, "package.json"),
        JSON.stringify({
          name: "isolated-profile",
          private: true,
          dependencies,
        }),
      );
      const profile: Profile = {
        name: shadow ? "old" : "fixed",
        dir: profileDir,
        layers: [],
        patches: [],
        patchPath: join(profileDir, "cordis.patch.yml"),
        skippedBundles: [],
      };
      const resolution = await createRuntimeResolution({
        installAnchor: fileURLToPath(
          new URL("../package.json", import.meta.url),
        ),
        home: root,
        profile,
      });
      await ctx.plugin(PluginPackages, { resolution });
      const profileUrl = pathToFileURL(entry).href;
      const selected = ctx.pluginPackages.packageOf(
        "@deepseek-ai/dsh-scope",
        profileUrl,
      );
      assert.ok(selected);
      const hostDir = await realpath(
        dirname(
          fileURLToPath(
            import.meta.resolve("@deepseek-ai/dsh-scope/package.json"),
          ),
        ),
      );
      assert.equal((await realpath(selected.dir)) === hostDir, !shadow);
      const imported = (await import(profileUrl)) as {
        scope: typeof HostScope;
        SystemPrompt: typeof HostSystemPrompt;
      };
      assert.equal(
        imported.scope.createScope === HostScope.createScope,
        !shadow,
      );
      assert.equal(imported.SystemPrompt === HostSystemPrompt, !shadow);
      const key = {};
      const directScope = HostScope.createScope(ctx, key);
      assert.equal(HostScope.scopeOf(directScope.ctx), key);
      assert.equal(
        imported.scope.scopeOf(directScope.ctx),
        shadow ? undefined : key,
      );
      await directScope.dispose();

      // 注册真实官方服务与Loader，再让真实PresetRegistry挂载persona。
      ctx.baseUrl = pathToFileURL(`${profileDir}/`).href;
      await ctx.plugin(Loader);
      ctx.loader.builtins.group = Group;
      ctx.loader.builtins.persona = Persona;
      await ctx.plugin(LlmRuntime);
      await ctx.plugin(SessionStore);
      await ctx.plugin(ProjectionRegistry);
      await ctx.plugin(imported.SystemPrompt, { personaPrefix: "全局人设" });
      await ctx.plugin(ToolRuntime);
      await ctx.plugin(AgentRegistry);
      await ctx.plugin(AgentPresets, { default: "standard" });
      let unregister: (() => Promise<void>) | undefined;
      await ctx.plugin({
        inject: ["agentPresets"],
        async apply(owner: Context) {
          unregister = await owner.agentPresets.register({
            id: "standard",
            plugins: [
              {
                id: "persona",
                name: "cordis:persona",
                config: { prefix: "预设人设" },
              },
            ],
          });
          owner.effect(() => unregister!);
        },
      });
      const roster = await ctx.agentPresets.remoteExportList();
      const standard = roster.presets.find(
        (preset) => preset.id === "standard",
      );
      assert.ok(standard);
      if (shadow) {
        assert.match(
          standard.broken ?? "",
          /deployment:persona-prefix.*already registered/,
        );
        const scope = HostScope.createScope(ctx, {});
        await assert.rejects(
          ctx.agentPresets.mount(scope.ctx, "standard"),
          /already registered/,
        );
        await scope.dispose();
      } else {
        assert.equal(standard.broken, undefined);
        const scope = HostScope.createScope(ctx, {});
        await ctx.agentPresets.mount(scope.ctx, "standard");
        const scoped = await ctx.systemPrompt.assemble({
          scope: HostScope.scopeOf(scope.ctx)!,
        });
        assert.equal(
          scoped.sections.find(
            (section) => section.name === "deployment:persona-prefix",
          )?.text,
          "预设人设",
        );
        await scope.dispose();
        const global = await ctx.systemPrompt.assemble();
        assert.equal(
          global.sections.find(
            (section) => section.name === "deployment:persona-prefix",
          )?.text,
          "全局人设",
        );
      }
    } finally {
      await ctx.fiber.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("发布manifest将Host服务定义保留为peer，禁止重新引入生产shadow依赖", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  assert.equal(
    Object.keys(manifest.dependencies).some((name) =>
      name.startsWith("@deepseek-ai/"),
    ),
    false,
  );
  for (const name of [
    "@deepseek-ai/cordis",
    "@deepseek-ai/dsh-scope",
    "@deepseek-ai/dsh-session",
    "@deepseek-ai/dsh-agent",
    "@deepseek-ai/dsh-llm",
    "@deepseek-ai/dsh-typert-protocol",
  ]) {
    assert.ok(manifest.peerDependencies[name], name);
    assert.equal(
      manifest.devDependencies[name],
      manifest.peerDependencies[name],
      name,
    );
  }
});
