import type { Context } from "@deepseek-ai/cordis";
import { agentEvents } from "@deepseek-ai/dsh-agent";
import type {
  Agent,
  AgentOptions,
  AgentCancelCause,
  CancelOptions,
  InboxTarget,
} from "@deepseek-ai/dsh-agent";
import type { SDKAgent, Run, ModelSelection } from "@cursor/sdk";
import { createScope } from "@deepseek-ai/dsh-scope";
import type {
  Session,
  SessionId,
  TurnEndReason,
  SessionEventMap,
} from "@deepseek-ai/dsh-session";
import type { UserMessage } from "@deepseek-ai/dsh-llm";
import { CursorInbox } from "./inbox.js";
import { CursorEventProjector } from "./events.js";
import { raceAbortCall } from "./lifecycle.js";

async function bounded<T>(
  operation: Promise<T>,
  milliseconds = 5000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Cursor停止超时")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class CursorNativeAgent implements Agent {
  readonly scope;
  readonly ctx: Context;
  readonly dispatch;
  readonly inbox: CursorInbox;
  private active: Promise<void> | undefined;
  private run: Run | undefined;
  private cancelled: AgentCancelCause | undefined;
  private disposed = false;
  private ready = false;
  private revision = 0;
  private turn = 0;
  private running = false;
  private activityAbort: AbortController | undefined;
  private sendTask: Promise<Run> | undefined;
  private cancellationTask: Promise<void> | undefined;
  private failure: Error | undefined;
  private readonly submitted = new Set<string>();
  constructor(
    ctx: Context,
    readonly id: SessionId,
    readonly options: AgentOptions,
    readonly session: Session,
    private sdk: SDKAgent,
    private selection: ModelSelection,
    private flush: () => Promise<void>,
  ) {
    this.scope = createScope(ctx, this);
    this.ctx = this.scope.ctx;
    this.dispatch = agentEvents(ctx, this);
    this.inbox = new CursorInbox(session, this.dispatch);
    for (const event of session.snapshotEvents()) {
      if (event.type === "turn/start")
        this.turn = Math.max(this.turn, event.data.turn);
      if (event.type === "user/message") this.submitted.add(event.data.id);
      if (event.type === "agent/inbox/spliced")
        for (const message of event.data.inserted)
          this.submitted.add(message.id);
    }
  }
  get status(): "idle" | "running" {
    return this.running ? "running" : "idle";
  }
  private statusChanged(running: boolean) {
    if (running === this.running) return;
    this.running = running;
    this.dispatch.emit("agent/status", { status: this.status });
  }
  activate() {
    this.ready = true;
    this.wake();
  }
  send(message: UserMessage, target: InboxTarget, wakeup: boolean) {
    if (this.disposed) throw new Error("Cursor Agent 已释放");
    if (target !== "next-turn" || !wakeup)
      throw new Error("Cursor 原生模式暂不支持 steer/inject 或不唤醒的消息");
    if (message.content.some((block) => block.type !== "text"))
      throw new Error("Cursor MVP 目前仅支持文本输入");
    if (this.submitted.has(message.id))
      throw new Error("Cursor消息标识已经提交，拒绝重复发送");
    this.inbox.append(target, message);
    this.submitted.add(message.id);
    this.wake();
  }
  followup(message: UserMessage) {
    this.send(message, "next-turn", true);
  }
  steer(_message: UserMessage): never {
    throw new Error("Cursor 原生模式暂不支持 steer");
  }
  inject(_message: UserMessage): never {
    throw new Error("Cursor 原生模式暂不支持 inject");
  }
  runMaintenance<T>(_task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    throw new Error("Cursor 原生模式暂不支持 Harness maintenance/压缩");
  }
  cancel(cause: AgentCancelCause, options?: CancelOptions) {
    if (cause.kind === "disposed") this.disposed = true;
    if (!options?.keepInbox) this.inbox.clear();
    if (!this.active) return;
    this.cancelled ??= cause;
    this.activityAbort?.abort(new Error("Cursor运行已取消"));
    this.stopNativeRun();
  }
  private stopNativeRun() {
    if (!this.sendTask || this.cancellationTask) return;
    this.cancellationTask = this.sendTask.then(async (run) => {
      if (run.status === "running") await run.cancel();
      await run.wait();
    });
    void this.cancellationTask.catch(() => {});
  }
  async whenIdle(): Promise<void> {
    while (this.active) await this.active;
    if (this.failure) throw this.failure;
  }
  private wake() {
    if (
      !this.ready ||
      this.active ||
      this.disposed ||
      !this.inbox.nextTurn.length
    )
      return;
    this.statusChanged(true);
    this.active = Promise.resolve()
      .then(() => this.drain())
      .catch(() => {
        this.disposed = true;
        this.failure = new Error("Cursor会话持久化失败，已停止接收新消息");
        this.dispatch.emit("agent/error", {
          turn: this.turn,
          step: 1,
          error: new Error("Cursor会话持久化失败，已停止接收新消息"),
        });
      })
      .finally(() => {
        this.active = undefined;
        this.cancelled = undefined;
        this.statusChanged(false);
        this.wake();
      });
  }
  private async drain() {
    while (!this.disposed && this.inbox.nextTurn.length) {
      this.cancelled = undefined;
      this.activityAbort = new AbortController();
      const signal = this.activityAbort.signal;
      const turn = ++this.turn;
      this.session.append("turn/start", { turn });
      const message = this.inbox.claim(turn)!;
      this.session.append("step/start", { turn, step: 1 });
      let reason: TurnEndReason = { kind: "completed" };
      const projector = new CursorEventProjector({
        sessionId: this.id,
        turn,
        step: 1,
        model: this.selection.id,
        nextRevision: () => ++this.revision,
        emit: (frame) =>
          this.dispatch.emit("agent/assistant-stream", { frame }),
        append: (type, data) => {
          switch (type) {
            case "assistant/message":
              return this.session.append(
                "assistant/message",
                data as SessionEventMap["assistant/message"],
                { surfaceOp: "append" },
              ).seq;
            case "assistant/attempt":
              return this.session.append(
                "assistant/attempt",
                data as SessionEventMap["assistant/attempt"],
              ).seq;
            case "tool/call":
              return this.session.append(
                "tool/call",
                data as SessionEventMap["tool/call"],
              ).seq;
            case "tool/result":
              return this.session.append(
                "tool/result",
                data as SessionEventMap["tool/result"],
                { surfaceOp: "append" },
              ).seq;
          }
        },
        flush: this.flush,
      });
      try {
        this.session.append("user/message", message, { surfaceOp: "append" });
        await this.flush();
        if (this.cancelled) throw new Error("运行已取消");
        const text = message.content
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n");
        this.sendTask = this.sdk.send(text, {
          model: this.selection,
          idempotencyKey: message.id,
          onDelta: ({ update }) => {
            if (!signal.aborted) projector.onDelta(update);
          },
        });
        this.run = await raceAbortCall(signal, () => this.sendTask!);
        if (this.cancelled || this.disposed)
          throw new Error("Cursor运行已取消");
        const stream = this.run.stream();
        while (true) {
          const next = await raceAbortCall(signal, () => stream.next());
          if (next.done) break;
          const event = next.value;
          if (event.type === "request") {
            throw new Error(
              "Cursor 请求人工审批或交互；当前插件尚不支持响应，运行已取消",
            );
          }
          await projector.onMessage(event);
        }
        const result = await raceAbortCall(signal, () => this.run!.wait());
        if (result.status === "error") throw new Error("Cursor 原生运行失败");
        const interrupted =
          result.status === "cancelled" || this.cancelled !== undefined;
        await projector.settle({
          interrupted,
          ...(result.result === undefined
            ? {}
            : { fallbackText: result.result }),
        });
        if (interrupted)
          reason = {
            kind: "aborted",
            reason: this.cancelled ?? { kind: "user" },
          };
      } catch (error) {
        this.activityAbort?.abort(new Error("Cursor运行已终止"));
        try {
          await projector.settle({ interrupted: true });
        } catch {
          projector.abandon();
        }
        reason = this.cancelled
          ? { kind: "aborted", reason: this.cancelled }
          : {
              kind: "error",
              error: {
                code: "CURSOR_RUN_FAILED",
                message:
                  "Cursor 运行失败；如涉及人工审批或交互，当前插件不支持响应",
              },
            };
        this.dispatch.emit("agent/error", {
          turn,
          step: 1,
          error: new Error(
            reason.kind === "error"
              ? reason.error.message
              : "Cursor 运行已取消",
          ),
        });
      } finally {
        if (signal.aborted) {
          this.stopNativeRun();
          if (this.cancellationTask) {
            try {
              await bounded(this.cancellationTask);
            } catch {
              this.disposed = true;
              this.failure = new Error(
                "Cursor未确认停止，当前Agent不能继续使用",
              );
              this.dispatch.emit("agent/error", {
                turn,
                step: 1,
                error: new Error(
                  "Cursor尚未确认停止或清理失败，当前Agent已停用，请重新打开会话",
                ),
              });
            }
          }
        }
        this.run = undefined;
        this.sendTask = undefined;
        this.cancellationTask = undefined;
        this.activityAbort = undefined;
        this.session.append("step/end", { turn, step: 1 });
        this.session.append("turn/end", { turn, reason });
        await this.flush();
      }
    }
  }
  async close() {
    this.cancel({ kind: "disposed" });
    try {
      await this.whenIdle();
    } finally {
      try {
        await bounded(this.sdk[Symbol.asyncDispose]());
      } catch {
        throw new Error("Cursor SDK资源未能在期限内释放或释放失败");
      }
    }
  }
}
