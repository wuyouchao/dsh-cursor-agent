import { z } from "zod";
import { CursorAccountService } from "./host/remote-service.js";
import { watchAccountCatalog } from "./host/catalog-bridge.js";
import { resolveAdapterContext } from "./host/adapter-context.js";
import { CursorLlmAdapter } from "./adapter/index.js";
export const name = "dsh-cursor-agent";
export const inject = [];
export const Config = z.object({}).prefault({});
/** Cursor 作为真正模型适配器加入官方聊天，工具和权限由 Harness 执行。 */
export async function apply(ctx, _config = {}) {
    await ctx.plugin(CursorAccountService);
    await ctx.plugin({
        inject: ["llm", "agents", "workingDirectory", "cursorAccount"],
        apply(adapterCtx) {
            const account = adapterCtx.cursorAccount;
            const adapter = new CursorLlmAdapter({
                getModels: () => {
                    const state = account.getState();
                    return state.status === "connected" ? state.models : [];
                },
                resolveContext: (options) => resolveAdapterContext(adapterCtx, options),
            });
            adapterCtx.effect(() => {
                const registration = adapterCtx.llm.registerAdapter(["cursor"], adapter);
                const observer = new AbortController();
                const observing = watchAccountCatalog(account, () => registration.replace(["cursor"]), observer.signal).catch(() => {
                    if (!observer.signal.aborted)
                        adapterCtx.logger.warn("Cursor 模型目录状态订阅已停止，请重新加载插件。");
                });
                return async () => {
                    observer.abort();
                    await observing;
                    try {
                        await adapter.dispose();
                    }
                    finally {
                        registration();
                    }
                };
            }, "cursor.adapter: 模型目录、账号观察及请求生命周期");
        },
    });
    ctx.logger.info("Cursor 账号服务已加载；模型适配器随宿主聊天服务启用。");
}
export { CursorAccountService } from "./host/remote-service.js";
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map