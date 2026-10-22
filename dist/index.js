import { z } from "zod";
import { CursorAccountService } from "./host/remote-service.js";
import { applyRuntime } from "./runtime/index.js";
export const name = "dsh-cursor-agent";
export const inject = [
    "agents",
    "sessions",
    "llm",
    "sessionPersistence",
    "sessionProjections",
];
export const Config = z.object({
    stateDirectory: z.string().min(1).optional(),
    permissionMode: z
        .enum(["readonly", "workspace-write", "shell"])
        .default("readonly"),
    sandboxEnabled: z.boolean().default(true),
});
/** 专用 Cursor 模式：由官方 SDK 执行 Agent 与工具，Harness 负责展示。 */
export async function apply(ctx, config = {}) {
    await ctx.plugin(CursorAccountService);
    await ctx.plugin({
        inject: ["cursorAccount"],
        apply: (accountCtx) => applyRuntime(accountCtx, config, accountCtx.cursorAccount),
    });
    ctx.logger.info("Cursor 原生 Agent 已启用；账号管理位于模型设置页。");
}
export { CursorAccountService } from "./host/remote-service.js";
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map