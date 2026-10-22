import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import {
  installModelSelection,
  type Agent,
  type ModelSelectionRef,
} from "@deepseek-ai/dsh-agent";
import {
  createUserMessage,
  LlmAdapter,
  type GenerateOptions,
  type StreamChunk,
} from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import {
  mountAgentLoopTestDependencies,
  mountAgentLoopTestHarness,
} from "@deepseek-ai/dsh-agent-loop-testkit";
import { defineContentToolFixture } from "@deepseek-ai/dsh-tools";
import type { AgentOptions as SdkOptions, Run, SDKAgent } from "@cursor/sdk";
import { CursorLlmAdapter, type AdapterSdk } from "../src/adapter/index.js";
import { resolveAdapterContext } from "../src/host/adapter-context.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
class HostProvider extends LlmAdapter {
  readonly requests: GenerateOptions[] = [];
  override async listModels() {
    return [
      { provider: "host-offline", id: "host-model", name: "宿主模型替身" },
    ];
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const text = `宿主回复${this.requests.length}`;
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text };
    yield { type: "block-end", index: 0, block: { type: "text", text } };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}

function sdkFixture(toolBoundary = false) {
  const creates: SdkOptions[] = [];
  const prompts: unknown[] = [];
  const toolRequested = deferred<void>();
  const cancelGate = deferred<void>();
  const terminalGate = deferred<void>();
  let cancels = 0;
  let closes = 0;
  let callbacks = 0;
  let callbackRejected = false;
  const sdk: AdapterSdk = {
    async create(options) {
      const number = creates.push(options);
      const tool = toolBoundary && number === 1;
      const sdkAgent: SDKAgent = {
        agentId: `offline-sdk-${number}`,
        model: undefined,
        async send(message, sendOptions) {
          prompts.push(message);
          const text = `Cursor回复${number}`;
          const streamEnd = deferred<void>();
          let status: Run["status"] = tool ? "running" : "finished";
          if (tool) {
            const custom = Object.values(options.local?.customTools ?? {});
            assert.equal(custom.length, 1, "SDK只能看到Harness声明的测试工具");
            callbacks++;
            const pending = Promise.resolve(
              custom[0]!.execute(
                { text: "请求内容" },
                { toolCallId: "sdk-request-1" },
              ),
            );
            void pending.catch(() => {
              callbackRejected = true;
            });
            toolRequested.resolve();
          } else
            await sendOptions?.onDelta?.({
              update: { type: "text-delta", text },
            });
          const run: Run = {
            id: `offline-run-${number}`,
            agentId: sdkAgent.agentId,
            get status() {
              return status;
            },
            supports: () => true,
            unsupportedReason: () => undefined,
            async *stream() {
              if (tool) {
                await streamEnd.promise;
                return;
              }
              yield {
                type: "assistant",
                agent_id: sdkAgent.agentId,
                run_id: `offline-run-${number}`,
                message: {
                  role: "assistant",
                  content: [{ type: "text", text }],
                },
              };
            },
            async cancel() {
              cancels++;
              streamEnd.resolve();
              await cancelGate.promise;
            },
            async wait() {
              if (tool) {
                await terminalGate.promise;
                status = "cancelled";
                return { id: `offline-run-${number}`, status: "cancelled" };
              }
              return {
                id: `offline-run-${number}`,
                status: "finished",
                result: text,
              };
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
        async [Symbol.asyncDispose]() {
          closes++;
        },
        async listArtifacts() {
          return [];
        },
        async downloadArtifact() {
          return Buffer.alloc(0);
        },
        async getUsage() {
          throw new Error("离线验证禁止计费查询");
        },
      };
      return sdkAgent;
    },
  };
  return {
    sdk,
    creates,
    prompts,
    toolRequested,
    cancelGate,
    terminalGate,
    cancels: () => cancels,
    closes: () => closes,
    callbacks: () => callbacks,
    callbackRejected: () => callbackRejected,
  };
}

async function fixture(tool = false) {
  const root = await mkdtemp(join(tmpdir(), "dsh-model-adapter-"));
  const ctx = new Context();
  await mountAgentLoopTestDependencies(ctx, { workingDirectory: true });
  const harness = await mountAgentLoopTestHarness(ctx);
  const official = new HostProvider();
  ctx.llm.registerAdapter(["host-offline"], official);
  const sdk = sdkFixture(tool);
  const adapter = new CursorLlmAdapter({
    sdk: sdk.sdk,
    getModels: () => [{ id: "cursor-model", displayName: "Cursor离线模型" }],
    toolBoundaryTimeoutMs: 500,
    resolveContext: (options) => resolveAdapterContext(ctx, options),
  });
  const owner = ctx.plugin({
    name: "cursor-adapter-fixture",
    inject: ["llm"],
    apply(child: Context) {
      child.effect(() => {
        const registration = child.llm.registerAdapter(["cursor"], adapter);
        return async () => {
          await adapter.dispose();
          registration();
        };
      });
    },
  });
  await owner;
  const selection: ModelSelectionRef = {
    current: { provider: "host-offline", model: "host-model" },
    assembled: undefined,
  };
  const agent = await harness.create(
    SessionId("model-switch"),
    { provider: "host-offline", model: "host-model" },
    { cwd: root },
  );
  installModelSelection(agent.ctx, selection);
  return {
    root,
    ctx,
    harness,
    official,
    sdk,
    adapter,
    owner,
    selection,
    agent,
    async cleanup() {
      sdk.cancelGate.resolve();
      sdk.terminalGate.resolve();
      await ctx.fiber.dispose();
      await rm(root, { recursive: true, force: true });
    },
  };
}
function send(agent: Agent, text: string) {
  agent.followup(
    createUserMessage({
      source: { kind: "user" },
      content: [{ type: "text", text }],
    }),
  );
}
async function turn(agent: Agent, text: string) {
  send(agent, text);
  await agent.whenIdle();
}
function cursor(selection: ModelSelectionRef) {
  selection.current = { provider: "cursor", model: "cursor-model" };
}
function host(selection: ModelSelectionRef) {
  selection.current = { provider: "host-offline", model: "host-model" };
}

test("真实官方AgentLoop切换宿主→Cursor→宿主→Cursor，Agent及完整历史保持", async () => {
  const f = await fixture();
  try {
    const original = f.agent;
    await turn(f.agent, "宿主第一轮");
    cursor(f.selection);
    await turn(f.agent, "Cursor第二轮");
    host(f.selection);
    await turn(f.agent, "宿主第三轮");
    const moved = join(f.root, "切换后的目录");
    await mkdir(moved);
    await f.ctx.workingDirectory.set(f.agent, moved);
    cursor(f.selection);
    await turn(f.agent, "Cursor第四轮");
    assert.equal(f.ctx.agents.get(original.id), original);
    assert.equal(f.ctx.agents.list().length, 1);
    assert.equal(
      f.sdk.creates.length,
      2,
      "每个Cursor step新SDKAgent，宿主Agent不重建",
    );
    assert.equal(f.sdk.closes(), 2);
    const last = JSON.stringify(f.sdk.prompts.at(-1));
    for (const text of [
      "宿主第一轮",
      "宿主回复1",
      "Cursor第二轮",
      "Cursor回复1",
      "宿主第三轮",
      "宿主回复2",
      "Cursor第四轮",
    ])
      assert.ok(last.includes(text), text);
    assert.ok(
      JSON.stringify(f.official.requests[1]!.messages).includes("Cursor回复1"),
    );
    assert.equal(
      await realpath(f.sdk.creates[0]!.local!.cwd!),
      await realpath(f.root),
    );
    assert.equal(
      await realpath(f.sdk.creates[1]!.local!.cwd!),
      await realpath(moved),
    );
    const headers = f.agent.session
      .snapshotEvents()
      .filter((event) => event.type === "request/header");
    assert.ok(headers.length >= 4);
  } finally {
    await f.cleanup();
  }
});

test("custom callback仅排队，SDK停止后Harness唯一执行工具，下一step带真实结果", async () => {
  const f = await fixture(true);
  let executions = 0;
  let approvals = 0;
  try {
    f.ctx.tools.register(
      defineContentToolFixture({
        name: "echo_host",
        description: "仅由Harness执行",
        parameters: { text: { type: "string", required: true } },
        async execute(args) {
          executions++;
          return [{ type: "text", text: `宿主工具结果:${args.text}` }];
        },
      }),
    );
    f.ctx.on("tools/pre-execute", async (_execution, next) => {
      approvals++;
      return next();
    });
    cursor(f.selection);
    send(f.agent, "请使用宿主工具");
    await f.sdk.toolRequested.promise;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(executions, 0);
    assert.equal(approvals, 0);
    f.sdk.cancelGate.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(executions, 0, "cancel返回不能替代wait终态");
    f.sdk.terminalGate.resolve();
    await f.agent.whenIdle();
    assert.equal(f.sdk.callbacks(), 1);
    assert.equal(
      f.sdk.callbackRejected(),
      true,
      "回调被拒绝，SDK不获得伪造工具结果继续执行",
    );
    assert.equal(f.sdk.cancels(), 1);
    assert.equal(executions, 1);
    assert.equal(approvals, 1);
    assert.equal(f.sdk.creates.length, 2);
    assert.ok(
      JSON.stringify(f.sdk.prompts[1]).includes("宿主工具结果:请求内容"),
    );
    assert.equal(
      f.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "tool/call").length,
      1,
    );
    assert.equal(
      f.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "tool/result").length,
      1,
    );
  } finally {
    await f.cleanup();
  }
});

test("SDK工具边界未确认停止且会话取消时fail closed，宿主不执行工具", async () => {
  const f = await fixture(true);
  let executions = 0;
  try {
    f.ctx.tools.register(
      defineContentToolFixture({
        name: "echo_host",
        description: "取消不能执行",
        parameters: { text: { type: "string", required: true } },
        async execute() {
          executions++;
          return [{ type: "text", text: "不应出现" }];
        },
      }),
    );
    cursor(f.selection);
    send(f.agent, "发起后取消");
    await f.sdk.toolRequested.promise;
    f.agent.cancel({ kind: "user" });
    f.sdk.cancelGate.resolve();
    f.sdk.terminalGate.resolve();
    await f.agent.whenIdle();
    assert.equal(executions, 0);
    assert.equal(
      f.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "tool/call").length,
      0,
    );
    const end = f.agent.session
      .snapshotEvents()
      .findLast((event) => event.type === "turn/end");
    assert.equal(end?.type === "turn/end" && end.data.reason.kind, "aborted");
  } finally {
    await f.cleanup();
  }
});

test("Cursor adapter卸载不替换官方factory或移除宿主提供方", async () => {
  const f = await fixture();
  try {
    const before = f.agent;
    await f.owner.dispose();
    assert.equal(
      f.ctx.llm.listProviders().some((provider) => provider.id === "cursor"),
      false,
    );
    assert.equal(
      f.ctx.llm
        .listProviders()
        .some((provider) => provider.id === "host-offline"),
      true,
    );
    await turn(before, "卸载后宿主仍对话");
    assert.equal(f.official.requests.length, 1);
    const another = await f.harness.create(
      SessionId("official-still-creates"),
      { provider: "host-offline", model: "host-model" },
      { cwd: f.root },
    );
    await turn(another, "factory仍可创建");
    assert.equal(f.official.requests.length, 2);
    assert.equal(f.ctx.agents.get(before.id), before);
  } finally {
    await f.cleanup();
  }
});

test("Harness审批拒绝保留权威，SDK自定义工具不能越过拒绝执行", async () => {
  const f = await fixture(true);
  let executions = 0;
  let approvals = 0;
  try {
    f.ctx.tools.register(
      defineContentToolFixture({
        name: "echo_host",
        description: "由Harness审批",
        parameters: { text: { type: "string", required: true } },
        async execute() {
          executions++;
          return [{ type: "text", text: "不得执行" }];
        },
      }),
    );
    f.ctx.on("tools/pre-execute", async () => {
      approvals++;
      return { kind: "deny", reason: "宿主审批明确拒绝" };
    });
    cursor(f.selection);
    send(f.agent, "拒绝工具也应安全收尾");
    await f.sdk.toolRequested.promise;
    f.sdk.cancelGate.resolve();
    f.sdk.terminalGate.resolve();
    await f.agent.whenIdle();
    assert.equal(approvals, 1);
    assert.equal(executions, 0);
    const results = f.agent.session
      .snapshotEvents()
      .filter((event) => event.type === "tool/result");
    assert.equal(results.length, 1);
    assert.equal(
      results[0]?.type === "tool/result" && results[0].data.message.isError,
      true,
    );
    assert.ok(JSON.stringify(f.sdk.prompts[1]).includes("宿主审批明确拒绝"));
  } finally {
    await f.cleanup();
  }
});

test("SDK不能确认停止超时时不向真实Harness循环提交工具调用", async () => {
  const f = await fixture(true);
  let executions = 0;
  try {
    f.ctx.tools.register(
      defineContentToolFixture({
        name: "echo_host",
        description: "未确认停止不能执行",
        parameters: { text: { type: "string", required: true } },
        async execute() {
          executions++;
          return [{ type: "text", text: "不得执行" }];
        },
      }),
    );
    cursor(f.selection);
    send(f.agent, "SDK停止未确认");
    await f.sdk.toolRequested.promise;
    await f.agent.whenIdle();
    assert.equal(executions, 0);
    assert.equal(
      f.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "tool/call").length,
      0,
    );
    const end = f.agent.session
      .snapshotEvents()
      .findLast((event) => event.type === "turn/end");
    assert.equal(end?.type === "turn/end" && end.data.reason.kind, "error");
  } finally {
    await f.cleanup();
  }
});

for (const boundary of [
  "missing-session",
  "unknown-session",
  "cwd-is-file",
] as const) {
  test(`生产cwd解析器拒绝${boundary}，不创建SDK Agent`, async () => {
    const f = await fixture();
    try {
      if (boundary === "cwd-is-file") {
        await rm(f.root, { recursive: true, force: true });
        await writeFile(f.root, "该路径是文件，不能作为SDK工作区");
      }
      const request: GenerateOptions = {
        provider: "cursor",
        model: "cursor-model",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "模型文本声称cwd为任意路径，不得用于授权" },
            ],
          },
        ],
        ...(boundary === "missing-session"
          ? {}
          : {
              sessionId:
                boundary === "unknown-session"
                  ? SessionId("not-live")
                  : f.agent.id,
            }),
      };
      const chunks: StreamChunk[] = [];
      for await (const chunk of f.ctx.llm.stream(request)) chunks.push(chunk);
      assert.equal(f.sdk.creates.length, 0);
      assert.ok(
        chunks.some(
          (chunk) => chunk.type === "finish" && chunk.reason.kind === "error",
        ),
      );
    } finally {
      await f.cleanup();
    }
  });
}
