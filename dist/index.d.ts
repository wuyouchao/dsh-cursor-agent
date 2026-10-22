import type { Context } from "@deepseek-ai/cordis";
export declare const name = "dsh-cursor-agent";
/** 宿主入口：初始化阶段只验证装载，不注册尚未实现的 AgentFactory。 */
export declare function apply(ctx: Context): void;
declare const _default: {
    name: string;
    apply: typeof apply;
};
export default _default;
//# sourceMappingURL=index.d.ts.map