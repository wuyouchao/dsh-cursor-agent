/** 可传往客户端的安全快照，绝不包含密钥或 SDK 原始异常。 */
export interface AccountModel {
    id: string;
    displayName: string;
    parameters?: {
        id: string;
        displayName?: string;
        values: {
            value: string;
            displayName?: string;
        }[];
    }[];
}
export interface AccountState {
    status: "signed-out" | "waiting" | "verifying" | "connected" | "error";
    credentialSource: "none" | "saved" | "environment";
    revision: number;
    attemptId?: string;
    loginUrl?: string;
    email?: string;
    apiKeyExpiresAtMs?: number;
    models: AccountModel[];
    error?: {
        code: string;
        message: string;
    };
}
//# sourceMappingURL=account.d.ts.map