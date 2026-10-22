import assert from "node:assert/strict";
import test from "node:test";
import type { AgentOptions, SDKAgent, Run } from "@cursor/sdk";
import type { GenerateOptions, StreamChunk } from "@deepseek-ai/dsh-llm";
import { CursorLlmAdapter } from "../src/adapter/index.js";

const request: GenerateOptions = {
  provider: "cursor",
  model: "cached-model",
  messages: [{ role: "user", content: [{ type: "text", text: "测试" }] }],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function collect(stream: AsyncIterable<StreamChunk>) {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}
function fixture(mode: "text" | "tool" | "timeout" = "text") {
  let options!: AgentOptions;
  let disposed = 0;
  let cancelled = 0;
  const terminal = deferred<void>();
  const run: Run = {
    id: "run",
    agentId: "agent",
    status: "running",
    supports: () => true,
    unsupportedReason: () => undefined,
    onDidChangeStatus: () => () => {},
    async conversation() {
      return [];
    },
    async cancel() {
      cancelled++;
      if (mode === "timeout") await new Promise<void>(() => {});
      terminal.resolve();
    },
    async wait() {
      if (mode !== "text") await terminal.promise;
      return {
        id: "run",
        status: mode === "text" ? "finished" : "cancelled",
        ...(mode === "text" ? { result: "回复" } : {}),
      };
    },
    async *stream() {
      if (mode !== "text") {
        const pending = options.local!.customTools!.harness_tool_0!.execute(
          { path: "a" },
          { toolCallId: "requested-tool" },
        );
        await pending;
      } else
        yield {
          type: "assistant",
          agent_id: "agent",
          run_id: "run",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "回复" }],
          },
        };
    },
  };
  const agent = {
    agentId: "agent",
    async send(_text: unknown, sendOptions: Parameters<SDKAgent["send"]>[1]) {
      if (mode === "text")
        await sendOptions?.onDelta?.({
          update: { type: "text-delta", text: "回复" },
        });
      return run;
    },
    async [Symbol.asyncDispose]() {
      disposed++;
    },
  } as SDKAgent;
  const adapter = new CursorLlmAdapter({
    getModels: () => [{ id: "cached-model", displayName: "缓存模型" }],
    resolveContext: async () => ({ cwd: process.cwd() }),
    sdk: {
      async create(config) {
        options = config;
        return agent;
      },
    },
    toolBoundaryTimeoutMs: 25,
  });
  return {
    adapter,
    agent,
    run,
    options: () => options,
    disposed: () => disposed,
    cancelled: () => cancelled,
  };
}

test("目录仅缓存，文本delta/final去重且SDK所有原生工具禁用", async () => {
  const f = fixture();
  assert.equal((await f.adapter.listModels())[0]?.id, "cached-model");
  const chunks = await collect(f.adapter.stream(request));
  assert.equal(
    chunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.text)
      .join(""),
    "回复",
  );
  assert.deepEqual(f.options().tools, []);
  assert.deepEqual(f.options().mcpServers, {});
  assert.deepEqual(f.options().local?.settingSources, []);
  assert.equal(f.disposed(), 1);
  await f.adapter.dispose();
});

test("SDK回调只提出请求，确认cancel和wait终态及资源释放后交给Harness", async () => {
  const f = fixture("tool");
  const chunks = await collect(
    f.adapter.stream({
      ...request,
      tools: [
        { name: "read", description: "读取", parameters: { type: "object" } },
      ],
    }),
  );
  assert.deepEqual(f.options().tools, ["mcp"]);
  assert.equal(f.cancelled(), 1);
  assert.equal(f.disposed(), 1);
  const calls = chunks.filter(
    (chunk) => chunk.type === "block-end" && chunk.block.type === "tool-call",
  );
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls).includes('"name":"read"'), true);
  assert.equal(chunks.at(-1)?.type, "finish");
});

test("取消无法确认终态时不输出任何Harness工具调用", async () => {
  const f = fixture("timeout");
  const chunks: StreamChunk[] = [];
  await assert.rejects(async () => {
    for await (const chunk of f.adapter.stream({
      ...request,
      tools: [{ name: "read", description: "读取", parameters: {} }],
    }))
      chunks.push(chunk);
  }, /未确认停止/);
  assert.equal(
    chunks.some((chunk) => chunk.type === "tool-call-delta"),
    false,
  );
  assert.equal(f.disposed(), 1);
});

test("创建阶段取消不等待迟到SDK，迟到资源只释放一次", async () => {
  const f = fixture();
  const pending = deferred<SDKAgent>();
  const started = deferred<void>();
  const abort = new AbortController();
  const adapter = new CursorLlmAdapter({
    getModels: () => [{ id: "cached-model", displayName: "模型" }],
    resolveContext: async () => ({ cwd: process.cwd() }),
    sdk: {
      async create() {
        started.resolve();
        return pending.promise;
      },
    },
    toolBoundaryTimeoutMs: 25,
  });
  const running = collect(adapter.stream({ ...request, signal: abort.signal }));
  await started.promise;
  abort.abort();
  await assert.rejects(running, /取消/);
  pending.resolve(f.agent);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.disposed(), 1);
  await adapter.dispose();
});

test("未知缓存模型及未支持参数不会创建SDK请求", async () => {
  const f = fixture();
  await assert.rejects(
    collect(f.adapter.stream({ ...request, model: "unknown" })),
    /模型不可用/,
  );
  await assert.rejects(
    collect(f.adapter.stream({ ...request, maxTokens: 10 })),
    /不支持/,
  );
  assert.equal(f.disposed(), 0);
});

test("消费者提前归还迭代器会取消SDK并关闭事件迭代器", async () => {
  const f = fixture();
  let returned = 0;
  f.run.stream = () =>
    ({
      next: () => new Promise<IteratorResult<never>>(() => {}),
      async return() {
        returned++;
        return { done: true as const, value: undefined };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    }) as AsyncGenerator<never, void>;
  const iterator = f.adapter.stream(request)[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).done, false);
  await iterator.return?.();
  assert.equal(f.cancelled(), 1);
  assert.equal(f.disposed(), 1);
  assert.equal(returned, 1);
});

test("SDK已终态但事件流无法关闭时仍不交出工具调用", async () => {
  const f = fixture("tool");
  let returned = 0;
  f.run.stream = () =>
    ({
      next: () => {
        void Promise.resolve(
          f
            .options()
            .local!.customTools!.harness_tool_0!.execute({ path: "x" }, {}),
        ).catch(() => {});
        return new Promise<IteratorResult<never>>(() => {});
      },
      return() {
        returned++;
        return new Promise<IteratorResult<never>>(() => {});
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    }) as AsyncGenerator<never, void>;
  const chunks: StreamChunk[] = [];
  await assert.rejects(async () => {
    for await (const chunk of f.adapter.stream({
      ...request,
      tools: [{ name: "read", description: "读取", parameters: {} }],
    }))
      chunks.push(chunk);
  }, /事件流/);
  assert.equal(returned, 1);
  assert.equal(
    chunks.some((chunk) => chunk.type === "tool-call-delta"),
    false,
  );
});

test("send尚未分配资源时取消，迟到send分配的新lease仍真实释放", async () => {
  const f = fixture();
  const started = deferred<void>();
  const pending = deferred<Run>();
  const abort = new AbortController();
  let allocated = false;
  let releases = 0;
  let disposeCalls = 0;
  f.agent.send = async () => {
    started.resolve();
    const run = await pending.promise;
    allocated = true;
    return run;
  };
  f.agent[Symbol.asyncDispose] = async () => {
    disposeCalls++;
    if (allocated) {
      allocated = false;
      releases++;
    }
  };
  const running = collect(
    f.adapter.stream({ ...request, signal: abort.signal }),
  );
  await started.promise;
  abort.abort();
  await assert.rejects(running, /取消/);
  assert.equal(disposeCalls, 1);
  assert.equal(releases, 0, "初次释放时SDK尚未分配lease");
  pending.resolve(f.run);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disposeCalls, 2, "不能复用已完成的首次dispose Promise");
  assert.equal(releases, 1, "迟到send新分配的lease已释放");
  assert.equal(allocated, false);
});
