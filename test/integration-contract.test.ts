import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { parse } from "yaml";
import { composeEntries } from "@deepseek-ai/dsh-app-boot";
import type { InvocationDescriptor } from "@deepseek-ai/dsh-typert-protocol";
type PatchOptions = Parameters<typeof composeEntries>[0][number][number];
import { TYPERT } from "../lib/typert.host.js";
import { TYPERT_REMOTE } from "../lib/typert.remote-client.js";

const conflicts = [
  "agent-loop",
  "session-title-llm",
  "plan-mode",
  "compaction-basic",
  "llm-deepseek",
  "llm-deepseek-account",
  "llm-pi-ai",
];

test("真实 Harness patch 合成只修改专用模式目标，移除bundle恢复基底", async () => {
  const patch = parse(
    await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8"),
  ) as PatchOptions[];
  const base: PatchOptions[] = [
    {
      insert: [
        ...conflicts.map((id) => ({
          id,
          name: `test:${id}`,
          config: { preserved: id },
        })),
        {
          id: "agent-default-model",
          name: "test:default",
          config: {
            provider: "deepseek",
            model: "saved-user-model",
            reasoningEffort: "high",
          },
        },
        {
          id: "user-unrelated",
          name: "test:user",
          config: { nested: { user: true } },
        },
      ],
    },
  ];
  const original = structuredClone(base);
  const baseline = composeEntries([base]);
  const active = composeEntries([base, patch]);
  for (const id of conflicts)
    assert.equal(active.find((row) => row.id === id)?.disabled, true, id);
  assert.deepEqual(
    active.find((row) => row.id === "agent-default-model")?.config,
    { provider: "cursor", model: "default" },
  );
  assert.deepEqual(
    active.find((row) => row.id === "user-unrelated"),
    baseline.find((row) => row.id === "user-unrelated"),
  );
  assert.equal(active.filter((row) => row.id === "dsh-cursor-agent").length, 1);
  assert.deepEqual(base, original, "合成不得原地修改基底");
  assert.deepEqual(
    composeEntries([base]),
    baseline,
    "删除bundle层后恢复原配置",
  );
});

test("真实生成Host与Client契约一致且watch直接转交流handle", () => {
  const metadata = TYPERT as { invocations: InvocationDescriptor[] };
  assert.ok(Array.isArray(metadata.invocations));
  assert.equal(metadata.invocations.length, 6);
  for (const host of metadata.invocations) {
    const client =
      TYPERT_REMOTE.methods[
        `cursorAccount/${host.method}` as keyof typeof TYPERT_REMOTE.methods
      ];
    assert.ok(client);
    assert.equal(host.namespace, "cursorAccount");
    assert.equal(host.id, client.id);
    assert.equal(host.result.mode, "strict");
    if (host.result.mode === "strict")
      assert.deepEqual(host.result.jsonSchema, client.result.jsonSchema);
  }
  const cancel = TYPERT_REMOTE.methods["cursorAccount/cancelLogin"];
  assert.throws(() => cancel.input().create().parse({ attemptId: 123 }));
  assert.equal(
    cancel.input().create().parse({ attemptId: "attempt" }).attemptId,
    "attempt",
  );
  const watch = TYPERT_REMOTE.methods["cursorAccount/watch"];
  assert.equal(watch.mode, "stream");
  assert.deepEqual(watch.cancellation, { parameter: "signal" });
  const signal = new AbortController().signal;
  const handle = {
    send() {},
    end() {},
    dispose() {},
    async *[Symbol.asyncIterator]() {},
  };
  const remote = {
    cursorAccount: {
      watch(received?: AbortSignal) {
        assert.equal(received, signal);
        return handle;
      },
    },
  };
  // 类型由生成器约束；这里仅核对运行时转交不包装Promise、不丢失handle。
  assert.equal(
    watch.invoke(
      remote as unknown as Parameters<typeof watch.invoke>[0],
      {},
      signal,
    ),
    handle,
  );
});

test("已构建客户端按Harness lazy factory注册，加载前不执行依赖", async () => {
  const source = await readFile(
    new URL("../dist/client.js", import.meta.url),
    "utf8",
  );
  let registration:
    | { id: string; factory: (require: (id: string) => unknown) => unknown }
    | undefined;
  runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load(value: typeof registration) {
          registration = value;
        },
      },
    },
  });
  assert.equal(registration?.id, "dsh-cursor-agent");
  assert.equal(typeof registration?.factory, "function");
  assert.match(source, /settings\.models\.footer/);
  assert.doesNotMatch(source, /secret-key|apiKey\s*:/);
});
