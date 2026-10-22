export const DEFAULT_API_KEY_NAME = "DeepSeek Harness Cursor Plugin";
/** 注入官方认证接口；本模块不会加载 SDK 运行时或自行保管凭据。 */
export function createCursorAuth(api) {
    return {
        async login(options = {}) {
            const result = await api.login({
                ...options,
                apiKeyName: options.apiKeyName ?? DEFAULT_API_KEY_NAME,
            });
            // 仅返回可展示字段，禁止把 SDK 返回的 apiKey 透传到界面或日志。
            return {
                status: "logged-in",
                ...(result.email === undefined ? {} : { email: result.email }),
                apiKeyExpiresAtMs: result.apiKeyExpiresAtMs,
            };
        },
        async status(options) {
            const result = await api.status(options);
            if (result.status === "logged-out") {
                return { status: "logged-out" };
            }
            return {
                status: "logged-in",
                backendUrl: result.backendUrl,
                ...(result.email === undefined ? {} : { email: result.email }),
                ...(result.apiKeyExpiresAtMs === undefined
                    ? {}
                    : { apiKeyExpiresAtMs: result.apiKeyExpiresAtMs }),
            };
        },
        async logout(options) {
            await api.logout(options);
        },
    };
}
//# sourceMappingURL=auth.js.map