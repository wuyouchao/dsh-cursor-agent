import { Context } from "@deepseek-ai/cordis";
import AgentRegistry from "@deepseek-ai/dsh-agent";
import type { AgentHandle } from "@deepseek-ai/dsh-agent";
import SessionStore, { SessionId } from "@deepseek-ai/dsh-session";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import ProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import * as JsonlPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import { MessageId } from "@deepseek-ai/dsh-llm";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { CursorFactory, createRuntimeSdk } from "./index.js";
import type { RuntimeConfig, RuntimeSdk } from "./index.js";
import {
  MappingStore,
  canonicalWorkspace,
  assertCheckpoint,
} from "./storage.js";
import { registerRuntimeProjections } from "./projections.js";
import type {
  CreateTaskInput,
  StandaloneRuntime,
  TaskMessage,
  TaskState,
  TaskSummary,
} from "../shared/tasks.js";

const OWNED_ID =
  /^cursor-native-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** 原生任务拥有独立事件域，宿主官方 Agent/LLM/预设均不可见其中的会话。 */
export async function createStandaloneRuntime(
  config: RuntimeConfig & { stateDirectory: string },
  injectedSdk?: RuntimeSdk,
): Promise<StandaloneRuntime> {
  if (!isAbsolute(config.stateDirectory))
    throw new Error("Cursor任务存储目录必须是绝对路径");
  const root = resolve(config.stateDirectory);
  const sdk = injectedSdk ?? (await createRuntimeSdk());
  const domain = new Context();
  const mappings = new MappingStore(join(root, "mappings"));
  const handles = new Map<string, AgentHandle>();
  const opening = new Map<string, Promise<TaskState>>();
  const revisions = new Map<string, number>();
  const attempts = new Map<string, string>();
  const liveText = new Map<string, TaskMessage[]>();
  const listeners = new Map<string, Set<() => void>>();
  let closed = false;
  let disposing: Promise<void> | undefined;
  let factory!: CursorFactory;
  const notify = (id: string) => {
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    for (const wake of listeners.get(id) ?? []) wake();
  };
  const assertOwned = (id: string) => {
    if (closed) throw new Error("Cursor任务运行域已关闭");
    if (!OWNED_ID.test(id)) throw new Error("任务不属于Cursor独立运行域");
  };
  try {
    await domain.plugin(SessionStore).await();
    await domain.plugin(AgentRegistry).await();
    await domain.plugin(ProjectionRegistry).await();
    await domain
      .plugin(JsonlPersistence, {
        root: join(root, "sessions"),
        compression: "none",
      })
      .await();
    await domain
      .plugin({
        name: "cursor-standalone-factory",
        inject: [
          "sessions",
          "agents",
          "sessionPersistence",
          "sessionProjections",
        ],
        apply(ctx: Context) {
          ctx.effect(() => registerRuntimeProjections(ctx));
          factory = new CursorFactory(
            ctx,
            { ...config, stateDirectory: root },
            sdk,
          );
        },
      })
      .await();
  } catch {
    await domain.fiber.dispose();
    throw new Error("Cursor独立任务运行域初始化失败");
  }

  domain.on("session/event", (session, event) => {
    if (
      (event.type === "assistant/message" &&
        event.data.message.content.some(
          (block) => block.type === "text" || block.type === "reasoning",
        )) ||
      event.type === "assistant/attempt"
    )
      liveText.delete(session.id);
    notify(session.id);
  });
  domain.on("agent/status", ({ agent }) => notify(agent.id));
  domain.on("agent/assistant-stream", ({ agent, frame }) => {
    if (frame.type === "start") liveText.set(agent.id, []);
    if (
      frame.type === "chunk" &&
      (frame.chunk.type === "text-delta" ||
        frame.chunk.type === "reasoning-delta")
    ) {
      const role = frame.chunk.type === "text-delta" ? "assistant" : "thinking";
      const messages = liveText.get(agent.id) ?? [];
      const previous = messages.at(-1);
      if (previous?.role === role) previous.text += frame.chunk.text;
      else
        messages.push({
          id: `${frame.attemptId}:${messages.length}`,
          role,
          text: frame.chunk.text,
        });
      liveText.set(agent.id, messages);
    }
    if (frame.type === "end") liveText.delete(agent.id);
    notify(agent.id);
  });

  function messagesOf(events: readonly SessionEvent[]): TaskMessage[] {
    const messages: TaskMessage[] = [];
    const tools = new Map<string, TaskMessage>();
    for (const event of events) {
      if (event.type === "user/message" || event.type === "assistant/message") {
        const message =
          event.type === "user/message" ? event.data : event.data.message;
        for (const [index, block] of message.content.entries())
          if (block.type === "text" || block.type === "reasoning")
            messages.push({
              id: `${message.id}:${index}`,
              role:
                block.type === "reasoning"
                  ? "thinking"
                  : message.role === "user"
                    ? "user"
                    : "assistant",
              text: block.text,
            });
      }
      if (event.type === "tool/call") {
        const message: TaskMessage = {
          id: event.data.callId,
          role: "tool",
          toolName: event.data.name,
          toolStatus: "running",
          text: event.data.arguments,
        };
        tools.set(event.data.callId, message);
        messages.push(message);
      }
      if (event.type === "tool/result") {
        const message = tools.get(event.data.message.toolCallId);
        if (message) {
          message.toolStatus = event.data.message.isError
            ? "error"
            : "completed";
          message.text = event.data.message.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
        }
      }
      if (event.type === "turn/end" && event.data.reason.kind === "error")
        messages.push({
          id: `error:${event.seq}`,
          role: "assistant",
          text: "Cursor任务执行失败，请检查账号状态、工作区权限或交互支持情况。",
        });
      if (event.type === "turn/end" && event.data.reason.kind === "aborted")
        messages.push({
          id: `cancelled:${event.seq}`,
          role: "assistant",
          text: "Cursor任务已取消。",
        });
    }
    return messages;
  }
  async function snapshot(id: string): Promise<TaskState> {
    assertOwned(id);
    const revision = revisions.get(id) ?? 0;
    const mapping = await mappings.get(id);
    const handle = handles.get(id);
    let unavailable =
      (handle?.agent as { unavailable?: boolean } | undefined)?.unavailable ===
      true;
    let events: readonly SessionEvent[];
    if (handle) events = handle.agent.session.snapshotEvents();
    else {
      const stored = await domain.sessionPersistence.open(
        SessionId(id),
        "read",
      );
      try {
        events = (await stored.read(0)).events;
      } finally {
        await stored.close();
      }
      try {
        if (resolve(mapping.storePath) !== join(root, "sdk"))
          throw new Error("store不匹配");
        await assertCheckpoint(sdk.store(mapping.storePath), mapping);
      } catch {
        unavailable = true;
      }
    }
    const messages = [...messagesOf(events), ...(liveText.get(id) ?? [])].map(
      (message) => ({ ...message }),
    );
    if (unavailable)
      messages.push({
        id: "cursor-unavailable",
        role: "assistant",
        text: handle
          ? "Cursor未能确认运行已安全停止或会话写入失败，当前任务不可继续。请检查后新建任务，勿重复执行可能尚未停止的工具。"
          : "此任务缺少可恢复的SDK检查点或存在未结束运行，当前不可恢复。新建后尚未发送的空任务也没有检查点，请新建任务。",
      });
    return {
      id,
      cwd: mapping.workspace,
      model: mapping.model.id,
      status: unavailable ? "unavailable" : (handle?.agent.status ?? "stored"),
      permissionMode: mapping.permissionMode,
      sandboxEnabled: mapping.sandboxEnabled,
      revision,
      ...(attempts.has(id) ? { attemptId: attempts.get(id)! } : {}),
      messages,
    };
  }
  async function resume(id: string): Promise<TaskState> {
    assertOwned(id);
    if (handles.has(id)) return snapshot(id);
    const pending = opening.get(id);
    if (pending) return pending;
    const operation = (async () => {
      const handle = await factory.resume(domain, {
        resumeSessionId: SessionId(id),
      });
      handles.set(id, handle);
      notify(id);
      return snapshot(id);
    })();
    opening.set(id, operation);
    try {
      return await operation;
    } finally {
      opening.delete(id);
    }
  }
  const controller: StandaloneRuntime = {
    async listModels() {
      if (closed) throw new Error("Cursor任务运行域已关闭");
      return (await factory.catalog.listModels()).map(({ id, name }) => ({
        id,
        name,
      }));
    },
    async listTasks() {
      if (closed) throw new Error("Cursor任务运行域已关闭");
      const tasks: TaskSummary[] = [];
      for (const row of await domain.sessionPersistence.list())
        if (OWNED_ID.test(row.header.id)) {
          const { messages: _, ...summary } = await snapshot(row.header.id);
          tasks.push(summary);
        }
      return tasks;
    },
    async create(input: CreateTaskInput) {
      if (closed) throw new Error("Cursor任务运行域已关闭");
      if (!isAbsolute(input.cwd)) throw new Error("Cursor工作区必须是绝对路径");
      const cwd = await canonicalWorkspace(input.cwd);
      if (!(await stat(cwd)).isDirectory())
        throw new Error("Cursor工作区必须是现有目录");
      const id = `cursor-native-${randomUUID()}`;
      const handle = await factory.createAgent(domain, {
        sessionId: SessionId(id),
        meta: { cwd },
        agentOptions: { provider: "cursor", model: input.model },
      });
      handles.set(id, handle);
      notify(id);
      return snapshot(id);
    },
    resume,
    async send(id, text) {
      assertOwned(id);
      if (typeof text !== "string" || !text.trim() || text.length > 100_000)
        throw new Error("请输入1至100000字符的任务提示词");
      await resume(id);
      const agent = handles.get(id)!.agent;
      if (agent.status !== "idle")
        throw new Error("Cursor任务正在运行，请等待结束或取消");
      attempts.set(id, randomUUID());
      agent.followup({
        id: MessageId(randomUUID()),
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text }],
      });
      notify(id);
      return snapshot(id);
    },
    async cancel(id, attemptId) {
      assertOwned(id);
      await mappings.get(id);
      if (attemptId !== undefined && attempts.get(id) !== attemptId)
        return snapshot(id);
      handles.get(id)?.agent.cancel({ kind: "user" });
      notify(id);
      return snapshot(id);
    },
    snapshot,
    async *watch(id, signal) {
      assertOwned(id);
      await mappings.get(id);
      let changed = true;
      let wake: (() => void) | undefined;
      const listener = () => {
        changed = true;
        wake?.();
      };
      const subscribers = listeners.get(id) ?? new Set();
      subscribers.add(listener);
      listeners.set(id, subscribers);
      signal.addEventListener("abort", listener);
      try {
        while (!closed && !signal.aborted) {
          if (changed) {
            changed = false;
            yield await snapshot(id);
          } else
            await new Promise<void>((resolve) => {
              wake = resolve;
              if (changed || signal.aborted || closed) resolve();
            });
        }
      } finally {
        subscribers.delete(listener);
        if (!subscribers.size) listeners.delete(id);
        signal.removeEventListener("abort", listener);
      }
    },
    async dispose() {
      if (disposing) return disposing;
      closed = true;
      for (const subscribers of listeners.values())
        for (const wake of subscribers) wake();
      return (disposing = (async () => {
        try {
          await factory.dispose();
        } finally {
          await domain.fiber.dispose();
          handles.clear();
        }
      })());
    },
  };
  return controller;
}
