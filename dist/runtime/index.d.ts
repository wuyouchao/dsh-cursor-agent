import { type AccountCatalogSource } from "../host/catalog-bridge.js";
import type { Context } from "@deepseek-ai/cordis";
import type { AgentFactory, AgentHandle, CreateAgentOptions, ResumeAgentOptions } from "@deepseek-ai/dsh-agent";
import type { AgentOptions as SdkOptions, LocalAgentStore, ModelListItem, SDKAgent } from "@cursor/sdk";
import { CursorCatalog } from "./catalog.js";
import type { AgentMapping } from "./storage.js";
export interface RuntimeConfig {
    stateDirectory?: string;
    permissionMode?: "readonly" | "workspace-write" | "shell";
    sandboxEnabled?: boolean;
}
export interface RuntimeSdk {
    create(options: SdkOptions): Promise<SDKAgent>;
    resume(id: string, options: SdkOptions): Promise<SDKAgent>;
    models(): Promise<ModelListItem[]>;
    store(path: string): LocalAgentStore;
}
export declare function cursorOptions(mapping: AgentMapping, store: LocalAgentStore): SdkOptions;
export declare class CursorFactory implements AgentFactory {
    private ctx;
    private config;
    private sdk;
    private readonly live;
    private readonly pending;
    private readonly abort;
    private readonly root;
    private readonly mappings;
    readonly catalog: CursorCatalog;
    constructor(ctx: Context, config: RuntimeConfig, sdk: RuntimeSdk);
    private tracked;
    createAgent(owner: Context, options: CreateAgentOptions): Promise<AgentHandle>;
    resume(owner: Context, options: ResumeAgentOptions): Promise<AgentHandle>;
    private start;
    private validate;
    private create;
    private restore;
    private publish;
    dispose(): Promise<void>;
}
export declare function applyRuntime(ctx: Context, config?: RuntimeConfig, account?: AccountCatalogSource): Promise<void>;
//# sourceMappingURL=index.d.ts.map