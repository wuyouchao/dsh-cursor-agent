import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import { JsonlLocalAgentStore, type SDKAgent, type Run } from "@cursor/sdk";
import type { RuntimeSdk } from "../src/runtime/index.js";
import { createStandaloneRuntime } from "../src/runtime/standalone.js";
import type { StandaloneRuntime, TaskState } from "../src/shared/tasks.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture(
  behavior: { checkpoint?: boolean; cancelFails?: boolean } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "cursor-standalone-"));
  const sends: string[] = [];
  let resumed = 0;
  let cancelled = 0;
  let created = 0;
  let pending: ReturnType<typeof deferred> | undefined;
  const started = deferred();
  const sdk: RuntimeSdk = {
    store: (path) => new JsonlLocalAgentStore(path),
    models: async () => [{ id: "offline-model", displayName: "离线模型" }],
    async create(options) {
      created++;
      assert.equal(options.local?.sandboxOptions?.enabled, true);
      assert.equal(options.tools?.includes("shell"), false);
      const agentId = `offline-${created}`;
      const store = options.local!.store!;
      if (behavior.checkpoint !== false)
        await store.checkpoints.create({
          agentId,
          blobId: "root",
          data: new Uint8Array([1]),
        });
      await store.agents.create({
        agent: {
          agentId,
          cwd: options.local!.cwd!,
          status: "idle",
          createdAt: 1,
          updatedAt: 1,
          ...(behavior.checkpoint !== false
            ? {
                latestCheckpoint: {
                  schemaVersion: 1 as const,
                  rootBlobId: "root",
                },
              }
            : {}),
        },
      });
      return agent(agentId);
    },
    async resume(id) {
      resumed++;
      return agent(id);
    },
  };
  function agent(agentId: string): SDKAgent {
    return {
      agentId,
      model: undefined,
      async send(message, options) {
        const text =
          typeof message === "string" ? message : JSON.stringify(message);
        sends.push(text);
        const gate = pending;
        started.resolve();
        await options?.onDelta?.({
          update: { type: "text-delta", text: `回复：${text}` },
        });
        const run: Run = {
          id: `run-${sends.length}`,
          agentId,
          status: gate ? "running" : "finished",
          supports: () => true,
          unsupportedReason: () => undefined,
          async *stream() {
            if (gate) await gate.promise;
            yield {
              type: "tool_call",
              agent_id: agentId,
              run_id: "run",
              call_id: `tool-${sends.length}`,
              name: "shell",
              status: "completed",
              args: { command: "不应在 Harness 执行" },
              result: "SDK 已执行",
            };
            yield {
              type: "assistant",
              agent_id: agentId,
              run_id: "run",
              message: {
                role: "assistant",
                content: [{ type: "text", text: `回复：${text}` }],
              },
            };
          },
          async wait() {
            if (gate) await gate.promise;
            return { id: "run", status: "finished", result: `回复：${text}` };
          },
          async cancel() {
            cancelled++;
            if (behavior.cancelFails)
              throw new Error("离线取消失败：不得泄露的 SDK 细节");
            gate?.resolve();
          },
          async conversation() {
            return [];
          },
          onDidChangeStatus: () => () => {},
        };
        return run;
      },
      close() {},
      async reload() {},
      async [Symbol.asyncDispose]() {},
      async listArtifacts() {
        return [];
      },
      async downloadArtifact() {
        return Buffer.alloc(0);
      },
      async getUsage() {
        throw new Error("离线测试禁止计费查询");
      },
    };
  }
  const runtimes: StandaloneRuntime[] = [];
  async function open() {
    const runtime = await createStandaloneRuntime(
      { stateDirectory: join(root, "state") },
      sdk,
    );
    runtimes.push(runtime);
    return runtime;
  }
  return {
    root,
    open,
    sends,
    started,
    resumed: () => resumed,
    cancelled: () => cancelled,
    created: () => created,
    block() {
      pending = deferred();
      return pending;
    },
    async cleanup(allowRuntimeFailure = false) {
      const results = await Promise.allSettled(
        runtimes.map((runtime) => runtime.dispose()),
      );
      await rm(root, { recursive: true, force: true });
      if (!allowRuntimeFailure)
        for (const result of results)
          if (result.status === "rejected") throw result.reason;
    },
  };
}

async function idle(
  runtime: StandaloneRuntime,
  id: string,
): Promise<TaskState> {
  return stateWithStatus(runtime, id, "idle");
}

async function stateWithStatus(
  runtime: StandaloneRuntime,
  id: string,
  status: TaskState["status"],
): Promise<TaskState> {
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(new Error("等待离线运行结束超时")),
    5000,
  );
  try {
    for await (const state of runtime.watch(id, abort.signal))
      if (state.status === status) return state;
    throw new Error("订阅提前关闭");
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}

test("独立运行域保留外部官方 registry/factory，验证 cwd 和任务所有权", async () => {
  const f = await fixture();
  const external = new Context();
  try {
    await external.plugin(AgentRegistry);
    const official = {
      createAgent: async () => {
        throw new Error("官方 factory");
      },
      resume: async () => {
        throw new Error("官方 factory");
      },
    };
    const release = external.agents.setFactory(official);
    const runtime = await f.open();
    await assert.rejects(runtime.create({ cwd: ".", model: "offline-model" }));
    assert.equal(f.created(), 0);
    const state = await runtime.create({ cwd: f.root, model: "offline-model" });
    assert.equal(state.permissionMode, "readonly");
    assert.equal(state.sandboxEnabled, true);
    assert.equal(external.agents.get(state.id as never), undefined);
    for (const operation of [
      () => runtime.snapshot("foreign"),
      () => runtime.resume("foreign"),
      () => runtime.send("foreign", "test"),
      () => runtime.cancel("foreign"),
    ])
      await assert.rejects(operation());
    assert.equal(f.sends.length, 0);
    assert.throws(
      () => external.agents.setFactory(official),
      /factory|already|registered/i,
    );
    release();
    external.agents.setFactory(official)();
  } finally {
    await external.fiber.dispose();
    await f.cleanup();
  }
});

test("SDK 初建无 checkpoint 时重开明确标记不可用且拒绝假恢复", async () => {
  const f = await fixture({ checkpoint: false });
  try {
    let runtime = await f.open();
    const task = await runtime.create({ cwd: f.root, model: "offline-model" });
    assert.equal(task.status, "idle");
    await runtime.dispose();
    runtime = await f.open();
    const summary = (await runtime.listTasks()).find(
      (row) => row.id === task.id,
    );
    assert.equal(summary?.status, "unavailable");
    const snapshot = await runtime.snapshot(task.id);
    assert.equal(snapshot.status, "unavailable");
    assert.match(
      snapshot.messages.map((message) => message.text).join("\n"),
      /checkpoint|检查点/i,
    );
    assert.match(
      snapshot.messages.map((message) => message.text).join("\n"),
      /新建|创建新/,
    );
    await assert.rejects(runtime.resume(task.id));
    assert.equal(f.resumed(), 0);
    assert.equal(f.sends.length, 0);
  } finally {
    await f.cleanup();
  }
});

test("取消失败且 SDK 未确认结束时进入不可用终态并拒绝继续发送", async () => {
  const f = await fixture({ cancelFails: true });
  const gate = f.block();
  try {
    const runtime = await f.open();
    const task = await runtime.create({ cwd: f.root, model: "offline-model" });
    await runtime.send(task.id, "取消失败回归");
    await f.started.promise;
    await runtime.cancel(task.id);
    const unavailable = await stateWithStatus(runtime, task.id, "unavailable");
    assert.equal(f.cancelled(), 1);
    assert.equal(unavailable.status, "unavailable");
    assert.equal((await runtime.snapshot(task.id)).status, "unavailable");
    await assert.rejects(runtime.send(task.id, "不能继续"));
    assert.deepEqual(f.sends, ["取消失败回归"]);
    assert.doesNotMatch(JSON.stringify(unavailable), /不得泄露的 SDK 细节/);
  } finally {
    gate.resolve();
    await f.cleanup(true);
  }
});

test("独立 JSONL 多轮、工具展示和关闭后恢复历史", async () => {
  const f = await fixture();
  try {
    let runtime = await f.open();
    assert.ok(
      (await runtime.listModels()).some(
        (model) => model.id === "offline-model",
      ),
    );
    const task = await runtime.create({ cwd: f.root, model: "offline-model" });
    for (const text of ["第一轮", "第二轮"]) {
      await runtime.send(task.id, text);
      await idle(runtime, task.id);
    }
    const before = await runtime.snapshot(task.id);
    const mutable = await runtime.snapshot(task.id);
    mutable.messages[0]!.text = "客户端修改";
    assert.deepEqual(
      (await runtime.snapshot(task.id)).messages,
      before.messages,
    );
    assert.deepEqual(f.sends, ["第一轮", "第二轮"]);
    assert.equal(
      before.messages.filter((message) => message.role === "user").length,
      2,
    );
    assert.equal(
      before.messages.filter((message) => message.role === "assistant").length,
      2,
    );
    assert.ok(
      before.messages.some(
        (message) => message.role === "tool" && message.toolName === "shell",
      ),
    );
    assert.doesNotThrow(() => JSON.stringify(before));
    await runtime.dispose();
    runtime = await f.open();
    assert.ok((await runtime.listTasks()).some((row) => row.id === task.id));
    const restored = await runtime.resume(task.id);
    assert.deepEqual(restored.messages, before.messages);
    assert.equal(f.resumed(), 1);
    await runtime.send(task.id, "第三轮");
    const after = await idle(runtime, task.id);
    assert.equal(
      after.messages.filter((message) => message.role === "assistant").length,
      3,
    );
  } finally {
    await f.cleanup();
  }
});

test("watch 首帧、运行变化、取消与卸载结束订阅", async () => {
  const f = await fixture();
  try {
    const runtime = await f.open();
    const task = await runtime.create({ cwd: f.root, model: "offline-model" });
    const abort = new AbortController();
    const watch = runtime.watch(task.id, abort.signal)[Symbol.asyncIterator]();
    assert.equal((await watch.next()).value?.id, task.id);
    f.block();
    await runtime.send(task.id, "等待取消");
    await f.started.promise;
    assert.equal((await runtime.snapshot(task.id)).status, "running");
    await assert.rejects(runtime.send(task.id, "不能并行发送"));
    await runtime.cancel(task.id, "上一轮过期标识");
    assert.equal(f.cancelled(), 0);
    assert.equal((await runtime.snapshot(task.id)).status, "running");
    await runtime.cancel(task.id);
    assert.equal((await idle(runtime, task.id)).status, "idle");
    assert.equal(f.cancelled(), 1);
    abort.abort();
    await watch.return?.();
    const disposalWatch = runtime
      .watch(task.id, new AbortController().signal)
      [Symbol.asyncIterator]();
    await disposalWatch.next();
    const next = disposalWatch.next();
    await runtime.dispose();
    assert.equal((await next).done, true);
  } finally {
    await f.cleanup();
  }
});
