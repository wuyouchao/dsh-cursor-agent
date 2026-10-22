import { z } from "zod";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CursorAccountService } from "./host/remote-service.js";
import { CursorTaskService } from "./host/task-service.js";
import { createStandaloneRuntime } from "./runtime/standalone.js";
export const name = "dsh-cursor-agent";
export const inject = [];
export const Config = z
    .object({
    stateDirectory: z.string().min(1).optional(),
    permissionMode: z
        .enum(["readonly", "workspace-write", "shell"])
        .default("readonly"),
    sandboxEnabled: z.boolean().default(true),
})
    .prefault({});
/** 账号与任务拥有独立运行域，保留宿主全部官方模型、Agent 和预设。 */
export async function apply(ctx, config = {}) {
    await ctx.plugin(CursorAccountService);
    const profile = ctx.get("profileContext");
    const stateDirectory = resolve(config.stateDirectory ??
        (profile?.dir
            ? join(profile.dir, "cursor-agent", "tasks")
            : join(homedir(), ".dsh", "cursor-agent", createHash("sha256")
                .update(resolve(process.cwd()))
                .digest("hex")
                .slice(0, 16), "tasks")));
    const runtime = await createStandaloneRuntime({ ...config, stateDirectory });
    try {
        ctx.fiber.assertActive();
        ctx.effect(() => () => runtime.dispose(), "cursor.tasks: 释放独立运行域");
        await ctx.plugin(CursorTaskService, runtime);
    }
    catch (error) {
        await runtime.dispose();
        throw error;
    }
    ctx.logger.info("Cursor 账号与独立任务已启用，可从设置和侧栏进入。");
}
export { CursorAccountService } from "./host/remote-service.js";
export { CursorTaskService } from "./host/task-service.js";
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map