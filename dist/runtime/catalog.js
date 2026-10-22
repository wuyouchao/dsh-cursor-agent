import { LlmAdapter } from "@deepseek-ai/dsh-llm";
export const CURSOR_PROVIDER = "cursor";
/** 目录路由始终可逆，绝不把界面合成 ID 传给 SDK。 */
export function modelRoutes(models) {
    return models.flatMap((model) => {
        const base = {
            provider: CURSOR_PROVIDER,
            name: model.displayName,
            inputModalities: ["text"],
        };
        const defaultVariant = model.variants?.find((variant) => variant.isDefault);
        const routes = [
            {
                ...base,
                id: model.id,
                selection: {
                    id: model.id,
                    ...(defaultVariant === undefined
                        ? {}
                        : {
                            params: defaultVariant.params,
                            ...(defaultVariant.isMaxMode === undefined
                                ? {}
                                : { maxMode: defaultVariant.isMaxMode }),
                        }),
                },
            },
        ];
        for (const variant of model.variants ?? []) {
            const selection = {
                id: model.id,
                params: variant.params,
                ...(variant.isMaxMode === undefined
                    ? {}
                    : { maxMode: variant.isMaxMode }),
            };
            routes.push({
                ...base,
                name: variant.displayName,
                id: `${model.id}::${Buffer.from(JSON.stringify(selection)).toString("base64url")}`,
                selection,
            });
        }
        return routes;
    });
}
/** 仅为原生 Agent 提供模型目录；明确拒绝通用补全调用。 */
export class CursorCatalog extends LlmAdapter {
    load;
    constructor(load) {
        super();
        this.load = load;
    }
    providerInfo() {
        return { id: CURSOR_PROVIDER, name: "Cursor 原生 Agent" };
    }
    async listModels() {
        const routes = modelRoutes(await this.load()).map(({ selection: _, ...info }) => info);
        return routes.length
            ? [
                {
                    provider: CURSOR_PROVIDER,
                    id: "default",
                    name: "Cursor 默认模型",
                    inputModalities: ["text"],
                },
                ...routes,
            ]
            : [];
    }
    async select(route) {
        const routes = modelRoutes(await this.load());
        const selected = route === undefined || route === "default"
            ? routes[0]
            : routes.find((entry) => entry.id === route);
        if (!selected)
            throw new Error("Cursor 模型不可用，请登录并刷新模型目录后重新选择");
        return structuredClone(selected.selection);
    }
    async *stream(_options) {
        throw new Error("Cursor 目录仅供原生 Agent 使用，不支持 Harness 通用 LLM 补全");
    }
}
//# sourceMappingURL=catalog.js.map