import type { Cursor, SdkAuthStatus, SdkAuthStatusOptions, SdkLoginOptions, SdkLogoutOptions } from "@cursor/sdk";
export type CursorAuthApi = typeof Cursor.auth;
export interface CursorLoginSummary {
    status: "logged-in";
    email?: string;
    apiKeyExpiresAtMs: number;
}
export declare const DEFAULT_API_KEY_NAME = "DeepSeek Harness Cursor Plugin";
/** 注入官方认证接口；本模块不会加载 SDK 运行时或自行保管凭据。 */
export declare function createCursorAuth(api: CursorAuthApi): {
    login(options?: SdkLoginOptions): Promise<CursorLoginSummary>;
    status(options?: SdkAuthStatusOptions): Promise<SdkAuthStatus>;
    logout(options?: SdkLogoutOptions): Promise<void>;
};
//# sourceMappingURL=auth.d.ts.map