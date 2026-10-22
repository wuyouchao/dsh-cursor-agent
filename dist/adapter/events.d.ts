import type { InteractionUpdate, RunResult, SDKMessage } from "@cursor/sdk";
import type { FinishReason, StreamChunk, ToolCallId } from "@deepseek-ai/dsh-llm";
export interface AdapterToolCall {
    id: ToolCallId;
    name: string;
    arguments: string;
}
/** 只投影单次模型调用；不拥有 Session，也不执行工具。 */
export declare class AdapterEventProjector {
    private active;
    private index;
    private ended;
    private readonly pending;
    private usage;
    get nextBlockIndex(): number;
    private assertOpen;
    closeBlocks(): StreamChunk[];
    private delta;
    onDelta(update: InteractionUpdate): StreamChunk[];
    private final;
    onMessage(message: SDKMessage): StreamChunk[];
    appendTools(calls: readonly AdapterToolCall[]): StreamChunk[];
    private mapUsage;
    finish(reason: FinishReason, result?: RunResult): StreamChunk[];
}
//# sourceMappingURL=events.d.ts.map