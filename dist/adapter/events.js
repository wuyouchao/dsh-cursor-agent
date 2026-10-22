/** 只投影单次模型调用；不拥有 Session，也不执行工具。 */
export class AdapterEventProjector {
    active;
    index = 0;
    ended = false;
    pending = { text: "", reasoning: "" };
    usage;
    get nextBlockIndex() {
        return this.index;
    }
    assertOpen() {
        if (this.ended)
            throw new Error("Cursor 模型流已结束");
    }
    closeBlocks() {
        this.assertOpen();
        if (!this.active)
            return [];
        const { index, type, text } = this.active;
        this.active = undefined;
        return [{ type: "block-end", index, block: { type, text } }];
    }
    delta(type, text) {
        this.assertOpen();
        if (!text)
            return [];
        const chunks = [];
        if (this.active?.type !== type) {
            chunks.push(...this.closeBlocks());
            this.active = { type, text: "", index: this.index++ };
            chunks.push({
                type: "block-start",
                index: this.active.index,
                blockType: type,
            });
        }
        this.active.text += text;
        chunks.push({
            type: type === "text" ? "text-delta" : "reasoning-delta",
            index: this.active.index,
            text,
        });
        return chunks;
    }
    onDelta(update) {
        this.assertOpen();
        const type = update.type === "text-delta"
            ? "text"
            : update.type === "thinking-delta"
                ? "reasoning"
                : undefined;
        if (!type || !("text" in update))
            return [];
        this.pending[type] += update.text;
        return this.delta(type, update.text);
    }
    final(type, text) {
        if (!text)
            return [];
        const pending = this.pending[type];
        // 两条通道各自消费未确认增量，允许早期 final 晚于后续阶段到达。
        if (pending.startsWith(text)) {
            this.pending[type] = pending.slice(text.length);
            return !this.pending[type] && this.active?.type === type
                ? this.closeBlocks()
                : [];
        }
        if (!text.startsWith(pending))
            throw new Error("Cursor final 与已展示增量不一致");
        this.pending[type] = "";
        return [
            ...this.delta(type, text.slice(pending.length)),
            ...this.closeBlocks(),
        ];
    }
    onMessage(message) {
        this.assertOpen();
        if (message.type === "assistant") {
            return this.final("text", message.message.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join(""));
        }
        if (message.type === "thinking")
            return this.final("reasoning", message.text);
        if (message.type === "usage")
            this.usage = this.mapUsage(message.usage);
        // SDK tool_call 是内部 MCP 实现；仅 customTools 回调可产生 Harness 工具请求。
        return [];
    }
    appendTools(calls) {
        const chunks = this.closeBlocks();
        for (const call of calls) {
            const index = this.index++;
            chunks.push({ type: "block-start", index, blockType: "tool-call" }, {
                type: "tool-call-delta",
                index,
                id: call.id,
                name: call.name,
                argumentsDelta: call.arguments,
            }, { type: "block-end", index, block: { type: "tool-call", ...call } });
        }
        return chunks;
    }
    mapUsage(usage) {
        return {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
            ...(usage.reasoningTokens === undefined
                ? {}
                : { reasoningTokens: usage.reasoningTokens }),
        };
    }
    finish(reason, result) {
        const chunks = this.closeBlocks();
        // result.result 可能包含已经展示的全轮汇总，禁止当成新文本追加。
        const usage = result?.usage ? this.mapUsage(result.usage) : this.usage;
        if (usage)
            chunks.push({ type: "usage", usage });
        chunks.push({ type: "finish", reason });
        this.ended = true;
        return chunks;
    }
}
//# sourceMappingURL=events.js.map