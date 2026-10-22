import type { Context } from "@deepseek-ai/cordis";

export const name = "dsh-cursor-agent";

/** 宿主入口：初始化阶段只验证装载，不注册尚未实现的 AgentFactory。 */
export function apply(ctx: Context): void {
  ctx.logger.info(
    "dsh-cursor-agent 基础插件已加载；Cursor Agent 桥接尚未启用。",
  );
}

export default { name, apply };
