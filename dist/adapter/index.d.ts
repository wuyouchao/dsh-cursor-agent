import type { AgentOptions as SdkAgentOptions, SDKAgent, ModelListItem } from "@cursor/sdk";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";
import type { GenerateOptions, LlmModelInfo, StreamChunk } from "@deepseek-ai/dsh-llm";
export interface AdapterSdk {
    create(options: SdkAgentOptions): Promise<SDKAgent>;
}
export interface AdapterOptions {
    getModels: () => readonly ModelListItem[];
    resolveContext: (options: GenerateOptions) => Promise<{
        cwd: string;
    }>;
    sdk?: AdapterSdk;
    toolBoundaryTimeoutMs?: number;
}
/** SDK 仅提出请求；只有 Harness 在审批后执行工具。本 adapter 不持有跨请求 Agent。 */
export declare class CursorLlmAdapter extends LlmAdapter {
    private readonly options;
    private readonly activities;
    private disposed;
    constructor(options: AdapterOptions);
    dispose(): Promise<void>;
    providerInfo(): {
        id: string;
        name: string;
    };
    listModels(): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string): Promise<{
        provider: string;
        id: string;
        name: string;
        inputModalities: readonly ["text"];
    }>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
//# sourceMappingURL=index.d.ts.map