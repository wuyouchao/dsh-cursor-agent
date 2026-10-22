import type { Context } from "@deepseek-ai/cordis";
import type { GenerateOptions } from "@deepseek-ai/dsh-llm";
/** 只从宿主正在管理的会话读取当前目录，不接受模型或客户端传入路径。 */
export declare function resolveAdapterContext(ctx: Context, options: GenerateOptions): Promise<{
    cwd: string;
}>;
//# sourceMappingURL=adapter-context.d.ts.map