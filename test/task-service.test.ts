import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { CursorTaskService } from "../src/host/task-service.js";
import type { StandaloneRuntime, TaskState } from "../src/shared/tasks.js";

async function fixture() {
  const calls: string[] = [];
  const state = {
    id: "task",
    cwd: "I:\\workspace",
    revision: 1,
    model: "route",
    status: "idle" as const,
    permissionMode: "readonly" as const,
    sandboxEnabled: true,
    apiKey: "secret-key",
    messages: [
      {
        id: "message",
        role: "assistant" as const,
        text: "内容",
        rawError: "secret-error",
      },
    ],
  };
  const runtime: StandaloneRuntime = {
    async listModels() {
      calls.push("models");
      return [{ id: "route", name: "模型", apiKey: "secret-key" }];
    },
    async listTasks() {
      calls.push("list");
      return [state];
    },
    async create() {
      calls.push("create");
      return state;
    },
    async resume() {
      calls.push("resume");
      return state;
    },
    async send() {
      calls.push("send");
      return state;
    },
    async cancel(_id, attemptId) {
      calls.push(`cancel:${attemptId}`);
      return state;
    },
    async snapshot() {
      return state;
    },
    async *watch(_id, signal) {
      if (!signal.aborted) yield state;
    },
    async dispose() {
      calls.push("dispose");
    },
  };
  const ctx = new Context();
  await ctx.plugin(CursorTaskService, runtime);
  return {
    ctx,
    runtime,
    calls,
    service: ctx.cursorTasks,
    close: () => ctx.fiber.dispose(),
  };
}

test("独立任务服务不隐式创建或发送；所有返回显式安全投影", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(f.calls, []);
    const models = await f.service.listModels();
    const tasks = await f.service.listTasks();
    const created = await f.service.create({
      cwd: "I:\\workspace",
      model: "route",
    });
    assert.deepEqual(f.calls, ["models", "list", "create"]);
    assert.equal(created.permissionMode, "readonly");
    assert.equal(created.sandboxEnabled, true);
    assert.doesNotMatch(
      JSON.stringify([models, tasks, created]),
      /secret-key|secret-error|rawError|apiKey/,
    );
    assert.equal("messages" in tasks[0]!, false);
  } finally {
    await f.close();
  }
});

test("无效输入不进入运行时；原始运行异常不会出站", async () => {
  const f = await fixture();
  try {
    assert.throws(() => f.service.create({ cwd: "relative", model: "route" }), {
      code: "gateway/bad-request",
    });
    assert.throws(() => f.service.send("task", " "), {
      code: "gateway/bad-request",
    });
    assert.throws(() => f.service.cancel("task", ""), {
      code: "gateway/bad-request",
    });
    assert.deepEqual(f.calls, []);
    f.runtime.send = async () => {
      throw new Error("secret-key backend raw error");
    };
    await assert.rejects(f.service.send("task", "hello"), (error) => {
      assert.equal((error as { code: string }).code, "cursor/task-failed");
      assert.doesNotMatch(String(error), /secret-key|backend raw error/);
      return true;
    });
  } finally {
    await f.close();
  }
});

test("同任务重复send拒绝，cancel不等待运行完成且传递attempt", async () => {
  const f = await fixture();
  let release!: (value: TaskState) => void;
  const state = await f.service.snapshot("task");
  f.runtime.send = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  try {
    const sending = f.service.send("task", "hello");
    assert.throws(() => f.service.send("task", "duplicate"), {
      code: "cursor/task-busy",
    });
    await f.service.cancel("task", "attempt-1");
    assert.ok(f.calls.includes("cancel:attempt-1"));
    release(state);
    await sending;
  } finally {
    await f.close();
  }
});

test("watch每一帧经过安全投影，取消订阅及时收尾", async () => {
  const f = await fixture();
  try {
    const abort = new AbortController();
    const iterator = f.service
      .watch("task", abort.signal)
      [Symbol.asyncIterator]();
    assert.doesNotMatch(
      JSON.stringify((await iterator.next()).value),
      /secret-key|secret-error|rawError/,
    );
    abort.abort();
    assert.equal((await iterator.next()).done, true);
  } finally {
    await f.close();
  }
});

test("watch数量有界，早退释放订阅配额", async () => {
  const f = await fixture();
  const abort = new AbortController();
  const iterators = Array.from({ length: 64 }, () =>
    f.service.watch("task", abort.signal)[Symbol.asyncIterator](),
  );
  try {
    await Promise.all(iterators.map((iterator) => iterator.next()));
    const overflow = f.service
      .watch("task", abort.signal)
      [Symbol.asyncIterator]();
    await assert.rejects(overflow.next(), { code: "cursor/task-busy" });
    await iterators[0]!.return?.();
    const replacement = f.service
      .watch("task", abort.signal)
      [Symbol.asyncIterator]();
    assert.equal((await replacement.next()).done, false);
    await replacement.return?.();
  } finally {
    abort.abort();
    await Promise.all(iterators.map((iterator) => iterator.return?.()));
    await f.close();
  }
});

test("不可用任务状态和固定安全提示可出站，未知属性仍被移除", async () => {
  const f = await fixture();
  try {
    const current = await f.service.snapshot("task");
    f.runtime.snapshot = async () => ({
      ...current,
      status: "unavailable",
      rawError: "secret",
    });
    const result = await f.service.snapshot("task");
    assert.equal(result.status, "unavailable");
    assert.equal("rawError" in result, false);
  } finally {
    await f.close();
  }
});
