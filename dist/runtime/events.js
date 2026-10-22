import { randomUUID } from "node:crypto";
import { AssistantStreamAccumulator, LlmAttemptId, MessageId, ToolCallId, } from "@deepseek-ai/dsh-llm";
/** 保留非 JSON 值的明确标记，防止工具展示破坏持久化。 */
function safeJson(value) {
    const ancestors = new WeakSet();
    const normalize = (item) => {
        if (typeof item === "bigint")
            return { $bigint: item.toString() };
        if (typeof item === "undefined" ||
            typeof item === "symbol" ||
            typeof item === "function")
            return { $unsupported: typeof item };
        if (typeof item === "number" && !Number.isFinite(item))
            return { $number: String(item) };
        if (item === null || typeof item !== "object")
            return item;
        if (ancestors.has(item))
            return { $unsupported: "circular" };
        ancestors.add(item);
        try {
            if (Array.isArray(item))
                return item.map(normalize);
            return Object.fromEntries(Object.keys(item).map((key) => {
                try {
                    return [key, normalize(Reflect.get(item, key))];
                }
                catch {
                    return [key, { $unsupported: "unreadable" }];
                }
            }));
        }
        finally {
            ancestors.delete(item);
        }
    };
    try {
        return JSON.stringify(normalize(value));
    }
    catch {
        return JSON.stringify({ $unsupported: "unserializable" });
    }
}
/** Cursor 原生工具仅投影为展示事件；此模块没有工具执行入口。 */
export class CursorEventProjector {
    options;
    accumulator = new AssistantStreamAccumulator();
    blocks = [];
    calls = new Set();
    results = new Set();
    active;
    frameIndex = 0;
    started = false;
    ended = false;
    usage;
    pending = { text: "", reasoning: "" };
    attemptId;
    constructor(options) {
        this.options = options;
        this.attemptId = LlmAttemptId(`${options.sessionId}:cursor:${randomUUID()}`);
    }
    push(chunk) {
        if (this.ended)
            throw new Error("Cursor 流已结束");
        const o = this.options;
        if (!this.started) {
            this.started = true;
            o.emit({
                type: "start",
                attemptId: this.attemptId,
                revision: o.nextRevision(),
                turn: o.turn,
                step: o.step,
            });
        }
        const timed = this.accumulator.push({ time: (o.now ?? Date.now)(), chunk });
        o.emit({
            type: "chunk",
            attemptId: this.attemptId,
            revision: o.nextRevision(),
            index: this.frameIndex++,
            ...timed,
        });
    }
    closeBlock() {
        if (!this.active)
            return;
        const { type, text, index } = this.active;
        const block = { type, text };
        this.blocks.push(block);
        this.push({ type: "block-end", index, block });
        this.active = undefined;
    }
    delta(type, text) {
        if (!text)
            return;
        if (this.active?.type !== type) {
            this.closeBlock();
            this.active = { type, text: "", index: this.blocks.length };
            this.push({
                type: "block-start",
                index: this.active.index,
                blockType: type,
            });
        }
        this.active.text += text;
        this.push({
            type: type === "text" ? "text-delta" : "reasoning-delta",
            index: this.active.index,
            text,
        });
    }
    onDelta(update) {
        if (update.type === "text-delta") {
            this.pending.text += update.text;
            this.delta("text", update.text);
        }
        if (update.type === "thinking-delta") {
            this.pending.reasoning += update.text;
            this.delta("reasoning", update.text);
        }
    }
    final(type, text) {
        // 消费各内容通道的未确认前缀，允许早期 final 晚于后续 delta 到达。
        const pending = this.pending[type];
        if (pending.startsWith(text)) {
            this.pending[type] = pending.slice(text.length);
            if (!this.pending[type] && this.active?.type === type)
                this.closeBlock();
            return;
        }
        if (!text.startsWith(pending))
            throw new Error("Cursor final 与已展示增量不一致");
        this.pending[type] = "";
        this.delta(type, text.slice(pending.length));
        this.closeBlock();
    }
    onMessage(message) {
        const o = this.options;
        if (message.type === "assistant") {
            const text = message.message.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("");
            this.final("text", text);
        }
        else if (message.type === "thinking") {
            this.final("reasoning", message.text);
        }
        else if (message.type === "usage") {
            const u = message.usage;
            this.usage = {
                inputTokens: u.inputTokens,
                outputTokens: u.outputTokens,
                totalTokens: u.totalTokens,
                cacheReadTokens: u.cacheReadTokens,
                cacheWriteTokens: u.cacheWriteTokens,
                ...(u.reasoningTokens === undefined
                    ? {}
                    : { reasoningTokens: u.reasoningTokens }),
            };
        }
        else if (message.type === "tool_call") {
            this.closeBlock();
            const callId = ToolCallId(message.call_id);
            if (!this.calls.has(message.call_id)) {
                const argumentsText = safeJson(message.args ?? {});
                const block = {
                    type: "tool-call",
                    id: callId,
                    name: message.name,
                    arguments: argumentsText,
                };
                // V4 要求工具开始前已有 assistant 宣告；此记录只描述 SDK 已执行的原生调用。
                const declaration = new AssistantStreamAccumulator();
                const time = (o.now ?? Date.now)();
                for (const chunk of [
                    { type: "block-start", index: 0, blockType: "tool-call" },
                    {
                        type: "tool-call-delta",
                        index: 0,
                        id: callId,
                        name: message.name,
                        argumentsDelta: argumentsText,
                    },
                    { type: "block-end", index: 0, block },
                    { type: "finish", reason: { kind: "tool-calls" } },
                ])
                    declaration.push({ time, chunk });
                o.append("assistant/message", {
                    turn: o.turn,
                    step: o.step,
                    message: {
                        id: MessageId(randomUUID()),
                        role: "assistant",
                        source: { kind: "model", provider: "cursor", model: o.model },
                        content: [block],
                    },
                    stream: [...declaration.snapshot()],
                });
                o.append("tool/call", {
                    turn: o.turn,
                    step: o.step,
                    callId,
                    name: message.name,
                    arguments: argumentsText,
                });
                this.calls.add(message.call_id);
            }
            if (message.status !== "running" && !this.results.has(message.call_id)) {
                o.append("tool/result", {
                    turn: o.turn,
                    step: o.step,
                    message: {
                        id: MessageId(randomUUID()),
                        role: "tool",
                        source: { kind: "tool", callId },
                        toolCallId: callId,
                        content: [
                            {
                                type: "text",
                                text: typeof message.result === "string"
                                    ? message.result
                                    : safeJson(message.result ?? null),
                            },
                        ],
                        ...(message.status === "error" ? { isError: true } : {}),
                    },
                });
                this.results.add(message.call_id);
            }
        }
    }
    /** 为 SDK 未报告结果的原生工具闭合展示记录，不推断工具执行结果。 */
    closePendingTools() {
        const o = this.options;
        for (const id of this.calls) {
            if (this.results.has(id))
                continue;
            const callId = ToolCallId(id);
            o.append("tool/result", {
                turn: o.turn,
                step: o.step,
                message: {
                    id: MessageId(randomUUID()),
                    role: "tool",
                    source: { kind: "tool", callId },
                    toolCallId: callId,
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: "Cursor 运行已结束，SDK 未报告此原生工具的结果。",
                        },
                    ],
                },
            });
            this.results.add(id);
        }
    }
    /** 持久化成功之后才发布 committed；写入失败发布 abandoned 并向调用者抛错。 */
    async settle(options = {}) {
        if (this.ended)
            return;
        if (!this.blocks.length && !this.active && options.fallbackText)
            this.delta("text", options.fallbackText);
        this.closeBlock();
        this.closePendingTools();
        if (this.usage)
            this.push({ type: "usage", usage: this.usage });
        this.push({ type: "finish", reason: { kind: "stop" } });
        const o = this.options;
        const stream = [...this.accumulator.snapshot()];
        const eventType = this.blocks.length
            ? "assistant/message"
            : "assistant/attempt";
        try {
            const seq = eventType === "assistant/message"
                ? o.append(eventType, {
                    turn: o.turn,
                    step: o.step,
                    message: {
                        id: MessageId(randomUUID()),
                        role: "assistant",
                        source: { kind: "model", provider: "cursor", model: o.model },
                        content: this.blocks,
                    },
                    stream,
                    ...(this.usage ? { usage: this.usage } : {}),
                    ...(options.interrupted ? { interrupted: true } : {}),
                })
                : o.append(eventType, { turn: o.turn, step: o.step, stream });
            await o.flush();
            this.ended = true;
            o.emit({
                type: "end",
                attemptId: this.attemptId,
                revision: o.nextRevision(),
                index: this.frameIndex,
                outcome: { kind: "committed", eventType, seq },
            });
        }
        catch (error) {
            this.abandon();
            throw error;
        }
    }
    abandon() {
        if (this.ended)
            return;
        this.ended = true;
        if (this.started)
            this.options.emit({
                type: "end",
                attemptId: this.attemptId,
                revision: this.options.nextRevision(),
                index: this.frameIndex,
                outcome: { kind: "abandoned" },
            });
    }
}
//# sourceMappingURL=events.js.map