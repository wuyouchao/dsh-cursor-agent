import type { ModelListItem, ModelSelection } from "@cursor/sdk";
import { LlmAdapter } from "@deepseek-ai/dsh-llm";
import type { GenerateOptions, LlmModelInfo, StreamChunk } from "@deepseek-ai/dsh-llm";
export declare const CURSOR_PROVIDER = "cursor";
/** 目录路由始终可逆，绝不把界面合成 ID 传给 SDK。 */
export declare function modelRoutes(models: readonly ModelListItem[]): {
    provider: string;
    name: string;
    inputModalities: readonly ["text"];
    id: string;
    selection: ModelSelection;
}[];
/** 仅为原生 Agent 提供模型目录；明确拒绝通用补全调用。 */
export declare class CursorCatalog extends LlmAdapter {
    private readonly load;
    constructor(load: () => Promise<ModelListItem[]>);
    providerInfo(): {
        id: string;
        name: string;
    };
    listModels(): Promise<readonly LlmModelInfo[]>;
    select(route?: string): Promise<ModelSelection>;
    stream(_options: GenerateOptions): AsyncIterable<StreamChunk>;
}
//# sourceMappingURL=catalog.d.ts.map