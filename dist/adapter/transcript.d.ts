import type { GenerateOptions } from "@deepseek-ai/dsh-llm";
export interface TranscriptLimits {
    /** 完整请求的 UTF-8 字节上限；超限拒绝，不截断会话。 */
    maxBytes?: number;
}
/**
 * 将 Harness 已组装的请求作为一条 SDK user 消息中的引用记录。
 * role 标签仅保留历史语义，不提供真正的 SDK system/developer 权限隔离。
 * 本函数不读取凭据，不传递来源的私有回放元数据，不执行任何工具。
 */
export declare function serializeTranscript(options: GenerateOptions, limits?: TranscriptLimits): string;
//# sourceMappingURL=transcript.d.ts.map