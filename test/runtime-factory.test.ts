import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import SessionStore, {
  SessionId,
  SessionLogOffset,
  type SessionHeader,
  type SessionEvent,
} from "@deepseek-ai/dsh-session";
import {
  SessionPersistence,
  SessionPersistenceRevision,
  type SessionHandle,
  type SessionAccess,
} from "@deepseek-ai/dsh-session-persistence";
import {
  JsonlLocalAgentStore,
  type SDKAgent,
  type Run,
  type AgentOptions,
} from "@cursor/sdk";
import { MessageId } from "@deepseek-ai/dsh-llm";
import { CursorFactory, type RuntimeSdk } from "../src/runtime/index.js";

/** 真正的 Cordis 持久化服务定义；仅将磁盘替换为可检查的内存存储。 */
class MemoryPersistence extends SessionPersistence {
  readonly rows = new Map<
    string,
    { header: SessionHeader; events: SessionEvent[]; owned: boolean }
  >();
  closed = 0;
  constructor(ctx: Context) {
    super(ctx);
    ctx.on("session/event", (session, event) => {
      const row = this.rows.get(session.id);
      if (row?.owned) {
        assert.equal(
          event.seq,
          row.events.length,
          "发布后事件必须连续且只持久化一次",
        );
        row.events.push(event);
      }
    });
  }
  async create(header: SessionHeader): Promise<SessionHandle> {
    assert.equal(this.rows.has(header.id), false);
    this.rows.set(header.id, { header, events: [], owned: false });
    return this.open(header.id, "write");
  }
  async open(id: SessionId, access: SessionAccess): Promise<SessionHandle> {
    const row = this.rows.get(id);
    if (!row) throw new Error("session missing");
    if (access === "write") {
      assert.equal(row.owned, false);
      row.owned = true;
    }
    let closed = false;
    const check = () => {
      assert.equal(closed, false, "已关闭handle不可复用");
    };
    const close = async () => {
      if (closed) return;
      closed = true;
      this.closed++;
      if (access === "write") row.owned = false;
    };
    return {
      id,
      header: row.header,
      access,
      inheritedEventCount: SessionLogOffset(0),
      async read(offset = 0, length = Infinity) {
        check();
        return {
          eventState: "detached",
          events: structuredClone(row.events.slice(offset, offset + length)),
        };
      },
      async append(events) {
        check();
        for (const event of events) {
          assert.equal(event.seq, row.events.length);
          row.events.push(structuredClone(event));
        }
      },
      async flush() {
        check();
      },
      close,
      [Symbol.asyncDispose]: close,
    };
  }
  async flush() {}
  async stat(id: SessionId) {
    const row = this.rows.get(id);
    return row
      ? {
          header: row.header,
          revision: SessionPersistenceRevision(String(row.events.length)),
          eventCount: row.events.length,
        }
      : undefined;
  }
  async list() {
    return [...this.rows.values()].map((row) => ({
      header: row.header,
      revision: SessionPersistenceRevision(String(row.events.length)),
    }));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(backend: "memory" | "jsonl" = "memory") {
  const root = await mkdtemp(join(tmpdir(), "cursor-factory-test-"));
  const ctx = new Context();
  await ctx.plugin(SessionStore);
  await ctx.plugin(AgentRegistry);
  if (backend === "memory") await ctx.plugin(MemoryPersistence);
  else
    await ctx.plugin(
      await import("@deepseek-ai/dsh-session-persistence-jsonl"),
      { root: join(root, "sessions"), compression: "none" },
    );
  const ownerFiber = ctx.plugin({ name: "test-owner", apply() {} });
  await ownerFiber;
  const owner = ownerFiber.ctx;
  const store = new JsonlLocalAgentStore(join(root, "sdk"));
  let disposed = 0;
  let resumed = 0;
  const sends: string[] = [];
  const selections: unknown[] = [];
  let createGate: ReturnType<typeof deferred<SDKAgent>> | undefined;
  const sdkAgent: SDKAgent = {
    agentId: "offline-agent",
    model: undefined,
    async send(message, options) {
      sends.push(
        typeof message === "string" ? message : JSON.stringify(message),
      );
      selections.push(options?.model);
      await options?.onDelta?.({
        update: { type: "text-delta", text: "离线回复" },
      });
      const run: Run = {
        id: "offline-run",
        agentId: "offline-agent",
        status: "finished",
        supports: () => true,
        unsupportedReason: () => undefined,
        async *stream() {
          yield {
            type: "assistant",
            agent_id: "offline-agent",
            run_id: "offline-run",
            message: {
              role: "assistant",
              content: [{ type: "text", text: "离线回复" }],
            },
          };
        },
        async wait() {
          return { id: "offline-run", status: "finished", result: "离线回复" };
        },
        async cancel() {},
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
      disposed++;
    },
    async listArtifacts() {
      return [];
    },
    async downloadArtifact() {
      return Buffer.alloc(0);
    },
    async getUsage() {
      throw new Error("测试禁止查询计费");
    },
  };
  const sdk: RuntimeSdk = {
    async create(options: AgentOptions) {
      selections.push(options.model);
      return createGate ? createGate.promise : sdkAgent;
    },
    async resume() {
      resumed++;
      return sdkAgent;
    },
    async models() {
      return [{ id: "offline-model", displayName: "离线模型" }];
    },
    store: () => store,
  };
  let factory!: CursorFactory;
  await ctx.plugin({
    name: "fixture-runtime",
    inject: ["agents", "sessions", "sessionPersistence"],
    apply(runtimeCtx: Context) {
      factory = new CursorFactory(runtimeCtx, { stateDirectory: root }, sdk);
    },
  });
  ctx.agents.setFactory(factory);
  return {
    ctx,
    owner,
    ownerFiber,
    factory,
    root,
    store,
    sdkAgent,
    sends,
    selections,
    persistence: ctx.sessionPersistence as MemoryPersistence,
    disposed: () => disposed,
    resumed: () => resumed,
    delayCreate() {
      createGate = deferred<SDKAgent>();
      return createGate;
    },
    async cleanup() {
      const results = await Promise.allSettled([
        factory.dispose(),
        ctx.fiber.dispose(),
      ]);
      await rm(root, { recursive: true, force: true });
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "测试资源释放报告失败");
    },
  };
}

const id = (value: string) => SessionId(`factory-${value}`);

test("真实 Registry/SessionStore 支持多轮、持久化与所有权释放", async () => {
  const f = await fixture();
  try {
    const handle = await f.factory.createAgent(f.owner, {
      sessionId: id("multi"),
      meta: { cwd: f.root },
      agentOptions: { provider: "cursor", model: "offline-model" },
    });
    assert.equal(f.ctx.agents.get(handle.agent.id), handle.agent);
    assert.equal(f.ctx.sessions.get(handle.agent.id), handle.agent.session);
    for (const text of ["第一轮", "第二轮"]) {
      handle.agent.followup({
        id: MessageId(text),
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text }],
      });
      await handle.agent.whenIdle();
    }
    assert.deepEqual(f.sends, ["第一轮", "第二轮"]);
    assert.ok(
      f.selections.every(
        (selection) =>
          JSON.stringify(selection) === JSON.stringify({ id: "offline-model" }),
      ),
    );
    const persisted = f.persistence.rows.get(handle.agent.id)!.events;
    assert.equal(
      persisted.filter((event) => event.type === "assistant/message").length,
      2,
    );
    assert.equal(
      persisted.filter((event) => event.type === "turn/end").length,
      2,
    );
    assert.equal(
      handle.agent.session.snapshotEvents().length,
      persisted.length,
    );
    await handle.dispose();
    assert.equal(f.ctx.agents.get(id("multi")), undefined);
    assert.equal(f.ctx.sessions.get(id("multi")), undefined);
    assert.equal(f.disposed(), 1);
    assert.equal(f.persistence.closed, 1);
    await handle.dispose();
    assert.equal(f.disposed(), 1);
  } finally {
    await f.cleanup();
  }
});

for (const boundary of ["setup", "announce"] as const) {
  test(`${boundary} 抛错时真实注册表与持久化所有权回滚`, async () => {
    const f = await fixture();
    try {
      if (boundary === "announce")
        f.ctx.on("agent/created", () => {
          throw new Error("announce veto");
        });
      await assert.rejects(
        f.factory.createAgent(f.owner, {
          sessionId: id(boundary),
          meta: { cwd: f.root },
          ...(boundary === "setup"
            ? {
                setup: () => {
                  throw new Error("setup veto");
                },
              }
            : {}),
        }),
        /veto/,
      );
      assert.equal(f.ctx.agents.get(id(boundary)), undefined);
      assert.equal(f.ctx.sessions.get(id(boundary)), undefined);
      assert.equal(f.disposed(), 1);
      assert.equal(f.persistence.rows.get(id(boundary))?.owned, false);
    } finally {
      await f.cleanup();
    }
  });
}

test("SDK create 晚返回且调用方已取消时不发布并释放SDK", async () => {
  const f = await fixture();
  try {
    const gate = f.delayCreate();
    const abort = new AbortController();
    const creating = f.factory.createAgent(f.owner, {
      sessionId: id("cancel"),
      meta: { cwd: f.root },
      signal: abort.signal,
    });
    const rejected = assert.rejects(creating);
    await new Promise((resolve) => setTimeout(resolve, 15));
    abort.abort();
    gate.resolve(f.sdkAgent);
    await rejected;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.ctx.agents.get(id("cancel")), undefined);
    assert.equal(f.ctx.sessions.get(id("cancel")), undefined);
    assert.equal(f.disposed(), 1);
    assert.equal(f.persistence.rows.get(id("cancel"))?.owned, false);
  } finally {
    await f.cleanup();
  }
});

test("缺失checkpoint拒绝恢复且不调用SDK resume", async () => {
  const f = await fixture();
  try {
    const handle = await f.factory.createAgent(f.owner, {
      sessionId: id("missing"),
      meta: { cwd: f.root },
    });
    await handle.dispose();
    await assert.rejects(
      f.factory.resume(f.owner, { resumeSessionId: id("missing") }),
      /缺失|checkpoint/,
    );
    assert.equal(f.resumed(), 0);
    assert.equal(f.ctx.agents.get(id("missing")), undefined);
  } finally {
    await f.cleanup();
  }
});

test("SDK create 挂起时owner卸载可结束事务，迟到SDK只释放一次", async () => {
  const f = await fixture();
  try {
    const gate = f.delayCreate();
    const creating = f.factory.createAgent(f.owner, {
      sessionId: id("owner"),
      meta: { cwd: f.root },
    });
    const rejected = assert.rejects(creating);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await f.ownerFiber.dispose();
    await rejected;
    assert.equal(f.ctx.agents.get(id("owner")), undefined);
    gate.resolve(f.sdkAgent);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.disposed(), 1);
    assert.equal(f.persistence.rows.get(id("owner"))?.owned, false);
  } finally {
    await f.cleanup();
  }
});

test("send挂起取消可whenIdle，迟到run被取消且同一Agent可下一轮", async () => {
  const f = await fixture();
  try {
    const started = deferred<void>();
    const pending = deferred<Run>();
    const original = f.sdkAgent.send.bind(f.sdkAgent);
    let first = true;
    f.sdkAgent.send = async (message, options) => {
      if (!first) return original(message, options);
      first = false;
      started.resolve();
      return pending.promise;
    };
    const handle = await f.factory.createAgent(f.owner, {
      sessionId: id("send-cancel"),
      meta: { cwd: f.root },
    });
    const message = (text: string) => ({
      id: MessageId(text),
      role: "user" as const,
      source: { kind: "user" as const },
      content: [{ type: "text" as const, text }],
    });
    handle.agent.followup(message("挂起"));
    await started.promise;
    handle.agent.cancel({ kind: "user" });
    let idle = false;
    const waitingIdle = handle.agent.whenIdle().then(() => {
      idle = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(idle, false);
    let cancelled = 0;
    const late = await original("迟到", {});
    pending.resolve({
      ...late,
      status: "running",
      cancel: async () => {
        cancelled++;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    await waitingIdle;
    assert.equal(cancelled, 1);
    assert.equal(
      handle.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "assistant/message").length,
      0,
    );
    handle.agent.followup(message("继续"));
    await handle.agent.whenIdle();
    assert.equal(
      handle.agent.session
        .snapshotEvents()
        .filter((event) => event.type === "assistant/message").length,
      1,
    );
    await handle.dispose();
  } finally {
    await f.cleanup();
  }
});

test("完整入口依赖真实服务可用后注册账号、目录与唯一factory，卸载撤销", async () => {
  const { default: LlmRuntime } = await import("@deepseek-ai/dsh-llm");
  const { default: ProjectionRegistry } =
    await import("@deepseek-ai/dsh-session-projection");
  const { default: TypertRegistry } =
    await import("@deepseek-ai/dsh-typert-registry");
  const { default: plugin } = await import("../src/index.js");
  const root = await mkdtemp(join(tmpdir(), "cursor-plugin-services-"));
  const ctx = new Context();
  try {
    await ctx.plugin(SessionStore);
    await ctx.plugin(AgentRegistry);
    await ctx.plugin(MemoryPersistence);
    await ctx.plugin(TypertRegistry);
    await ctx.plugin(LlmRuntime);
    await ctx.plugin(ProjectionRegistry);
    const ready = deferred<void>();
    const stop = ctx.on("llm/adapters-updated", () => {
      if (ctx.llm.listProviders().some((provider) => provider.id === "cursor"))
        ready.resolve();
    });
    const fiber = ctx.plugin(plugin, { stateDirectory: root });
    await fiber;
    fiber.assertActive();
    assert.equal(ctx.cursorAccount.getState().status, "signed-out");
    await ready.promise;
    stop();
    assert.ok(
      ctx.llm.listProviders().some((provider) => provider.id === "cursor"),
    );
    assert.throws(
      () =>
        ctx.agents.setFactory({
          createAgent: async () => {
            throw new Error("unused");
          },
          resume: async () => {
            throw new Error("unused");
          },
        }),
      /factory|already|registered/i,
    );
    await fiber.dispose();
    assert.equal(
      ctx.llm.listProviders().some((provider) => provider.id === "cursor"),
      false,
    );
    assert.throws(() => ctx.cursorAccount.getState());
  } finally {
    await ctx.fiber.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("官方JSONL后端多轮事件无双写，关闭后真实恢复原历史再续聊", async () => {
  const f = await fixture("jsonl");
  try {
    const sessionId = id("jsonl-resume");
    const handle = await f.factory.createAgent(f.owner, {
      sessionId,
      meta: { cwd: f.root },
    });
    const message = (text: string) => ({
      id: MessageId(text),
      role: "user" as const,
      source: { kind: "user" as const },
      content: [{ type: "text" as const, text }],
    });
    handle.agent.followup(message("真实后端第一轮"));
    await handle.agent.whenIdle();
    const before = structuredClone(handle.agent.session.snapshotEvents());
    await handle.dispose();
    const stored = await f.ctx.sessionPersistence.open(sessionId, "read");
    const read = await stored.read();
    assert.deepEqual(read.events, before);
    await stored.close();
    await f.store.checkpoints.create({
      agentId: "offline-agent",
      blobId: "offline-checkpoint",
      data: new Uint8Array([1, 2, 3]),
    });
    await f.store.agents.create({
      agent: {
        agentId: "offline-agent",
        cwd: f.root,
        status: "idle",
        createdAt: 1,
        updatedAt: 1,
        latestCheckpoint: {
          schemaVersion: 1,
          rootBlobId: "offline-checkpoint",
        },
      },
    });
    const resumed = await f.factory.resume(f.owner, {
      resumeSessionId: sessionId,
    });
    assert.equal(f.resumed(), 1);
    const resumedEvents = resumed.agent.session.snapshotEvents();
    assert.deepEqual(resumedEvents.slice(0, before.length), before);
    assert.equal(resumedEvents.at(-1)?.type, "session/end-seed");
    resumed.agent.followup(message("真实后端第二轮"));
    await resumed.agent.whenIdle();
    await resumed.dispose();
    const reopened = await f.ctx.sessionPersistence.open(sessionId, "read");
    const all = (await reopened.read()).events;
    assert.equal(
      all.filter((event) => event.type === "assistant/message").length,
      2,
    );
    assert.equal(all.filter((event) => event.type === "turn/end").length, 2);
    assert.deepEqual(
      all.map((event) => event.seq),
      all.map((_, index) => index),
    );
    await reopened.close();
  } finally {
    await f.cleanup();
  }
});

test("取消中的cancel和wait都确认终态后才开始排队的下一轮", async () => {
  const f = await fixture();
  try {
    const cancelGate = deferred<void>();
    const terminalGate = deferred<void>();
    const started = deferred<void>();
    let calls = 0;
    let cancels = 0;
    const original = f.sdkAgent.send.bind(f.sdkAgent);
    f.sdkAgent.send = async (message, options) => {
      if (++calls > 1) return original(message, options);
      started.resolve();
      return {
        id: "pending-run",
        agentId: "offline-agent",
        status: "running",
        supports: () => true,
        unsupportedReason: () => undefined,
        async *stream() {
          await terminalGate.promise;
        },
        async wait() {
          await terminalGate.promise;
          return { id: "pending-run", status: "cancelled" };
        },
        async cancel() {
          cancels++;
          await cancelGate.promise;
        },
        async conversation() {
          return [];
        },
        onDidChangeStatus: () => () => {},
      };
    };
    const handle = await f.factory.createAgent(f.owner, {
      sessionId: id("cancel-wait"),
      meta: { cwd: f.root },
    });
    const message = (text: string) => ({
      id: MessageId(text),
      role: "user" as const,
      source: { kind: "user" as const },
      content: [{ type: "text" as const, text }],
    });
    handle.agent.followup(message("取消中的原轮"));
    await started.promise;
    handle.agent.cancel({ kind: "user" });
    handle.agent.followup(message("等待原轮终态"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    cancelGate.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1, "cancel返回不能代替wait终态");
    terminalGate.resolve();
    await handle.agent.whenIdle();
    assert.equal(cancels, 1);
    assert.equal(calls, 2);
    await handle.dispose();
  } finally {
    await f.cleanup();
  }
});

test("人工交互请求的cancel永久挂起时有界收尾且不再复用Agent", async () => {
  const f = await fixture();
  try {
    const started = deferred<void>();
    f.sdkAgent.send = async () => ({
      id: "request-run",
      agentId: "offline-agent",
      status: "running",
      supports: () => true,
      unsupportedReason: () => undefined,
      async *stream() {
        started.resolve();
        yield {
          type: "request",
          agent_id: "offline-agent",
          run_id: "request-run",
          request_id: "request",
          request: { type: "approval", message: "offline" },
        };
      },
      async wait() {
        return new Promise(() => {});
      },
      async cancel() {
        return new Promise(() => {});
      },
      async conversation() {
        return [];
      },
      onDidChangeStatus: () => () => {},
    });
    const handle = await f.factory.createAgent(f.owner, {
      sessionId: id("request-hang"),
      meta: { cwd: f.root },
    });
    handle.agent.followup({
      id: MessageId("request"),
      role: "user",
      source: { kind: "user" },
      content: [{ type: "text", text: "请求人工交互" }],
    });
    await started.promise;
    await assert.rejects(handle.agent.whenIdle(), /未确认停止/);
    assert.throws(
      () =>
        handle.agent.followup({
          id: MessageId("after-timeout"),
          role: "user",
          source: { kind: "user" },
          content: [{ type: "text", text: "不应复用" }],
        }),
      /释放|停止|终止/,
    );
    await assert.rejects(handle.dispose(), /未确认停止/);
  } finally {
    await f.cleanup();
  }
});

for (const face of ["source", "dist"] as const) {
  for (const mode of [
    "omitted",
    "patch",
    "empty",
    "explicit",
    "invalid",
  ] as const) {
    test(`生产${face}入口真实依赖配置路径：${mode}`, async () => {
      const { default: LlmRuntime } = await import("@deepseek-ai/dsh-llm");
      const { default: ProjectionRegistry } =
        await import("@deepseek-ai/dsh-session-projection");
      const { default: TypertRegistry } =
        await import("@deepseek-ai/dsh-typert-registry");
      const plugin =
        face === "source"
          ? (await import("../src/index.js")).default
          : (await import("../dist/index.js")).default;
      const root = await mkdtemp(join(tmpdir(), "cursor-config-load-"));
      const ctx = new Context();
      try {
        await ctx.plugin(SessionStore);
        await ctx.plugin(AgentRegistry);
        await ctx.plugin(MemoryPersistence);
        await ctx.plugin(TypertRegistry);
        await ctx.plugin(LlmRuntime);
        await ctx.plugin(ProjectionRegistry);
        let config: unknown;
        if (mode === "patch") {
          const { readFile } = await import("node:fs/promises");
          const { parse } = await import("yaml");
          const { composeEntries } = await import("@deepseek-ai/dsh-app-boot");
          const layers = parse(
            await readFile(
              new URL("../cordis.patch.yml", import.meta.url),
              "utf8",
            ),
          ) as Parameters<typeof composeEntries>[0][number];
          const entry = composeEntries([layers]).find(
            (row) => row.id === "dsh-cursor-agent",
          );
          assert.ok(entry, "取实际bundle patch产生的插件entry");
          config = entry.config;
        } else if (mode === "empty") config = {};
        else if (mode === "explicit")
          config = {
            stateDirectory: root,
            permissionMode: "shell",
            sandboxEnabled: false,
          };
        else if (mode === "invalid")
          config = { permissionMode: 123, sandboxEnabled: "false" };
        const fiber =
          mode === "omitted"
            ? ctx.plugin(plugin)
            : ctx.plugin(plugin, config as Parameters<typeof plugin.apply>[1]);
        if (mode === "invalid") {
          await assert.rejects(
            fiber.await(),
            /permissionMode|sandboxEnabled|Invalid|Expected/i,
          );
          assert.equal(fiber.state, 3, "真实FAILED状态，未启动apply");
          assert.equal(
            ctx.llm
              .listProviders()
              .some((provider) => provider.id === "cursor"),
            false,
          );
          assert.throws(() => ctx.cursorAccount.getState());
          const release = ctx.agents.setFactory({
            createAgent: async () => {
              throw new Error("unused");
            },
            resume: async () => {
              throw new Error("unused");
            },
          });
          release();
        } else {
          await fiber.await();
          assert.equal(
            fiber.state,
            2,
            "必须真正ACTIVE，不能仅依赖assertActive",
          );
          assert.equal(ctx.cursorAccount.getState().status, "signed-out");
          assert.ok(
            ctx.llm
              .listProviders()
              .some((provider) => provider.id === "cursor"),
          );
          assert.throws(
            () =>
              ctx.agents.setFactory({
                createAgent: async () => {
                  throw new Error("unused");
                },
                resume: async () => {
                  throw new Error("unused");
                },
              }),
            /factory|already|registered/i,
          );
          assert.equal(
            fiber.config.permissionMode,
            mode === "explicit" ? "shell" : "readonly",
          );
          assert.equal(
            fiber.config.sandboxEnabled,
            mode === "explicit" ? false : true,
          );
          if (mode === "explicit")
            assert.equal(fiber.config.stateDirectory, root);
        }
        await fiber.dispose();
        assert.equal(
          ctx.llm.listProviders().some((provider) => provider.id === "cursor"),
          false,
        );
      } finally {
        await ctx.fiber.dispose();
        await rm(root, { recursive: true, force: true });
      }
    });
  }
}
