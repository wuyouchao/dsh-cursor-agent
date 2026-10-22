import type { Context } from "@deepseek-ai/cordis";
import { z } from "zod";
import { type RuntimeConfig } from "./runtime/index.js";
export declare const name = "dsh-cursor-agent";
export declare const inject: string[];
export type Config = RuntimeConfig;
export declare const Config: z.ZodPrefault<z.ZodObject<{
    stateDirectory: z.ZodOptional<z.ZodString>;
    permissionMode: z.ZodDefault<z.ZodEnum<{
        readonly: "readonly";
        shell: "shell";
        "workspace-write": "workspace-write";
    }>>;
    sandboxEnabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>;
/** 专用 Cursor 模式：由官方 SDK 执行 Agent 与工具，Harness 负责展示。 */
export declare function apply(ctx: Context, config?: Config): Promise<void>;
export { CursorAccountService } from "./host/remote-service.js";
export type { AccountState, AccountModel } from "./shared/account.js";
declare const _default: {
    name: string;
    inject: string[];
    Config: z.ZodPrefault<z.ZodObject<{
        stateDirectory: z.ZodOptional<z.ZodString>;
        permissionMode: z.ZodDefault<z.ZodEnum<{
            readonly: "readonly";
            shell: "shell";
            "workspace-write": "workspace-write";
        }>>;
        sandboxEnabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    apply: typeof apply;
};
export default _default;
//# sourceMappingURL=index.d.ts.map