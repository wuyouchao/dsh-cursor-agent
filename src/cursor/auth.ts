import type {
  Cursor,
  SdkAuthStatus,
  SdkAuthStatusOptions,
  SdkLoginOptions,
  SdkLogoutOptions,
} from "@cursor/sdk";

export type CursorAuthApi = typeof Cursor.auth;

export interface CursorLoginSummary {
  status: "logged-in";
  email?: string;
  apiKeyExpiresAtMs: number;
}

export const DEFAULT_API_KEY_NAME = "DeepSeek Harness Cursor Plugin";

/** 注入官方认证接口；本模块不会加载 SDK 运行时或自行保管凭据。 */
export function createCursorAuth(api: CursorAuthApi) {
  return {
    async login(options: SdkLoginOptions = {}): Promise<CursorLoginSummary> {
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

    async status(options?: SdkAuthStatusOptions): Promise<SdkAuthStatus> {
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

    async logout(options?: SdkLogoutOptions): Promise<void> {
      await api.logout(options);
    },
  };
}
