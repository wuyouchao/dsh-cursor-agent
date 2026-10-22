import type { InteractionUpdate, SDKMessage } from "@cursor/sdk";
import { LlmAttemptId } from "@deepseek-ai/dsh-llm";
import type { AssistantStreamFrame } from "@deepseek-ai/dsh-agent";
import type { SessionEventMap, SessionId, SessionSeq } from "@deepseek-ai/dsh-session";
export interface CursorEventProjectorOptions {
    sessionId: SessionId;
    turn: number;
    step: number;
    model: string;
    nextRevision: () => number;
    emit: (frame: AssistantStreamFrame) => void;
    append: <K extends "assistant/message" | "assistant/attempt" | "tool/call" | "tool/result">(type: K, data: SessionEventMap[K]) => SessionSeq;
    flush: () => Promise<void>;
    now?: () => number;
}
/** Cursor 原生工具仅投影为展示事件；此模块没有工具执行入口。 */
export declare class CursorEventProjector {
    private readonly options;
    private readonly accumulator;
    private readonly blocks;
    private readonly calls;
    private readonly results;
    private active;
    private frameIndex;
    private started;
    private ended;
    private usage;
    private readonly pending;
    readonly attemptId: LlmAttemptId;
    constructor(options: CursorEventProjectorOptions);
    private push;
    private closeBlock;
    private delta;
    onDelta(update: InteractionUpdate): void;
    private final;
    onMessage(message: SDKMessage): void;
    /** 为 SDK 未报告结果的原生工具闭合展示记录，不推断工具执行结果。 */
    private closePendingTools;
    /** 持久化成功之后才发布 committed；写入失败发布 abandoned 并向调用者抛错。 */
    settle(options?: {
        interrupted?: boolean;
        fallbackText?: string;
    }): Promise<void>;
    abandon(): void;
}
//# sourceMappingURL=events.d.ts.map