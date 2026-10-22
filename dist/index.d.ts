import type { Context } from "@deepseek-ai/cordis";
import { z } from "zod";
import type { RuntimeConfig } from "./runtime/index.js";
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
/** 账号与任务拥有独立运行域，保留宿主全部官方模型、Agent 和预设。 */
export declare function apply(ctx: Context, config?: Config): Promise<void>;
export { CursorAccountService } from "./host/remote-service.js";
export { CursorTaskService } from "./host/task-service.js";
export type { AccountState, AccountModel } from "./shared/account.js";
export type { TaskModel, TaskMessage, TaskSummary, TaskState, CreateTaskInput, } from "./shared/tasks.js";
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