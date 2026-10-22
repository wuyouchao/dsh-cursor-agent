import { agentEvents } from "@deepseek-ai/dsh-agent";
import { createScope } from "@deepseek-ai/dsh-scope";
import { CursorInbox } from "./inbox.js";
import { CursorEventProjector } from "./events.js";
import { raceAbortCall } from "./lifecycle.js";
async function bounded(operation, milliseconds = 5000) {
    let timer;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error("Cursor停止超时")), milliseconds);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
export class CursorNativeAgent {
    id;
    options;
    session;
    sdk;
    selection;
    flush;
    scope;
    ctx;
    dispatch;
    inbox;
    active;
    run;
    cancelled;
    disposed = false;
    ready = false;
    revision = 0;
    turn = 0;
    running = false;
    activityAbort;
    sendTask;
    cancellationTask;
    failure;
    submitted = new Set();
    constructor(ctx, id, options, session, sdk, selection, flush) {
        this.id = id;
        this.options = options;
        this.session = session;
        this.sdk = sdk;
        this.selection = selection;
        this.flush = flush;
        this.scope = createScope(ctx, this);
        this.ctx = this.scope.ctx;
        this.dispatch = agentEvents(ctx, this);
        this.inbox = new CursorInbox(session, this.dispatch);
        for (const event of session.snapshotEvents()) {
            if (event.type === "turn/start")
                this.turn = Math.max(this.turn, event.data.turn);
            if (event.type === "user/message")
                this.submitted.add(event.data.id);
            if (event.type === "agent/inbox/spliced")
                for (const message of event.data.inserted)
                    this.submitted.add(message.id);
        }
    }
    get status() {
        return this.running ? "running" : "idle";
    }
    /** 独立任务 UI 使用；官方 Agent 状态协议没有失败态，不能把失败冒充可继续。 */
    get unavailable() {
        return this.failure !== undefined;
    }
    statusChanged(running) {
        if (running === this.running)
            return;
        this.running = running;
        this.dispatch.emit("agent/status", { status: this.status });
    }
    activate() {
        this.ready = true;
        this.wake();
    }
    send(message, target, wakeup) {
        if (this.disposed)
            throw new Error("Cursor Agent 已释放");
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
    followup(message) {
        this.send(message, "next-turn", true);
    }
    steer(_message) {
        throw new Error("Cursor 原生模式暂不支持 steer");
    }
    inject(_message) {
        throw new Error("Cursor 原生模式暂不支持 inject");
    }
    runMaintenance(_task) {
        throw new Error("Cursor 原生模式暂不支持 Harness maintenance/压缩");
    }
    cancel(cause, options) {
        if (cause.kind === "disposed")
            this.disposed = true;
        if (!options?.keepInbox)
            this.inbox.clear();
        if (!this.active)
            return;
        this.cancelled ??= cause;
        this.activityAbort?.abort(new Error("Cursor运行已取消"));
        this.stopNativeRun();
    }
    stopNativeRun() {
        if (!this.sendTask || this.cancellationTask)
            return;
        this.cancellationTask = this.sendTask.then(async (run) => {
            if (run.status === "running")
                await run.cancel();
            await run.wait();
        });
        void this.cancellationTask.catch(() => { });
    }
    async whenIdle() {
        while (this.active)
            await this.active;
        if (this.failure)
            throw this.failure;
    }
    wake() {
        if (!this.ready ||
            this.active ||
            this.disposed ||
            !this.inbox.nextTurn.length)
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
    async drain() {
        while (!this.disposed && this.inbox.nextTurn.length) {
            this.cancelled = undefined;
            this.activityAbort = new AbortController();
            const signal = this.activityAbort.signal;
            const turn = ++this.turn;
            this.session.append("turn/start", { turn });
            const message = this.inbox.claim(turn);
            this.session.append("step/start", { turn, step: 1 });
            let reason = { kind: "completed" };
            const projector = new CursorEventProjector({
                sessionId: this.id,
                turn,
                step: 1,
                model: this.selection.id,
                nextRevision: () => ++this.revision,
                emit: (frame) => this.dispatch.emit("agent/assistant-stream", { frame }),
                append: (type, data) => {
                    switch (type) {
                        case "assistant/message":
                            return this.session.append("assistant/message", data, { surfaceOp: "append" }).seq;
                        case "assistant/attempt":
                            return this.session.append("assistant/attempt", data).seq;
                        case "tool/call":
                            return this.session.append("tool/call", data).seq;
                        case "tool/result":
                            return this.session.append("tool/result", data, { surfaceOp: "append" }).seq;
                    }
                },
                flush: this.flush,
            });
            try {
                this.session.append("user/message", message, { surfaceOp: "append" });
                await this.flush();
                if (this.cancelled)
                    throw new Error("运行已取消");
                const text = message.content
                    .map((block) => (block.type === "text" ? block.text : ""))
                    .join("\n");
                this.sendTask = this.sdk.send(text, {
                    model: this.selection,
                    idempotencyKey: message.id,
                    onDelta: ({ update }) => {
                        if (!signal.aborted)
                            projector.onDelta(update);
                    },
                });
                this.run = await raceAbortCall(signal, () => this.sendTask);
                if (this.cancelled || this.disposed)
                    throw new Error("Cursor运行已取消");
                const stream = this.run.stream();
                while (true) {
                    const next = await raceAbortCall(signal, () => stream.next());
                    if (next.done)
                        break;
                    const event = next.value;
                    if (event.type === "request") {
                        throw new Error("Cursor 请求人工审批或交互；当前插件尚不支持响应，运行已取消");
                    }
                    await projector.onMessage(event);
                }
                const result = await raceAbortCall(signal, () => this.run.wait());
                if (result.status === "error")
                    throw new Error("Cursor 原生运行失败");
                const interrupted = result.status === "cancelled" || this.cancelled !== undefined;
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
            }
            catch (error) {
                this.activityAbort?.abort(new Error("Cursor运行已终止"));
                try {
                    await projector.settle({ interrupted: true });
                }
                catch {
                    projector.abandon();
                }
                reason = this.cancelled
                    ? { kind: "aborted", reason: this.cancelled }
                    : {
                        kind: "error",
                        error: {
                            code: "CURSOR_RUN_FAILED",
                            message: "Cursor 运行失败；如涉及人工审批或交互，当前插件不支持响应",
                        },
                    };
                this.dispatch.emit("agent/error", {
                    turn,
                    step: 1,
                    error: new Error(reason.kind === "error"
                        ? reason.error.message
                        : "Cursor 运行已取消"),
                });
            }
            finally {
                if (signal.aborted) {
                    this.stopNativeRun();
                    if (this.cancellationTask) {
                        try {
                            await bounded(this.cancellationTask);
                        }
                        catch {
                            this.disposed = true;
                            this.failure = new Error("Cursor未确认停止，当前Agent不能继续使用");
                            this.dispatch.emit("agent/error", {
                                turn,
                                step: 1,
                                error: new Error("Cursor尚未确认停止或清理失败，当前Agent已停用，请重新打开会话"),
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
        }
        finally {
            try {
                await bounded(this.sdk[Symbol.asyncDispose]());
            }
            catch {
                throw new Error("Cursor SDK资源未能在期限内释放或释放失败");
            }
        }
    }
}
//# sourceMappingURL=agent.js.map