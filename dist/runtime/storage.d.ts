import type { LocalAgentStore, ModelSelection } from "@cursor/sdk";
export interface AgentMapping {
    schemaVersion: 1;
    sdkVersion: "1.0.40";
    sessionId: string;
    agentId: string;
    workspace: string;
    storePath: string;
    permissionMode: "readonly" | "workspace-write" | "shell";
    sandboxEnabled: boolean;
    model: ModelSelection;
}
export declare function canonicalWorkspace(path: string): Promise<string>;
/** 与 SDK checkpoint 分离的公开映射；不保存任何凭据。 */
export declare class MappingStore {
    readonly root: string;
    constructor(root: string);
    private path;
    put(mapping: AgentMapping): Promise<void>;
    get(id: string): Promise<AgentMapping>;
}
export declare function assertCheckpoint(store: LocalAgentStore, mapping: AgentMapping): Promise<void>;
//# sourceMappingURL=storage.d.ts.map