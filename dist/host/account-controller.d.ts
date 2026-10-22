import { Cursor, type SdkCredentialStore } from "@cursor/sdk";
import type { AccountState } from "../shared/account.js";
export interface AccountControllerOptions {
    /** 仅用于离线 SDK 替身；生产 Cursor 的远端接口只读取官方默认凭据。 */
    store?: SdkCredentialStore;
    /** 仅用于离线 SDK 替身；生产环境以进程变量为准。 */
    hasEnvironmentKey?: () => boolean;
    timeoutMs?: number;
    disposeTimeoutMs?: number;
}
export declare function createAccountController(api: Pick<typeof Cursor, "auth" | "me" | "models">, options?: AccountControllerOptions): {
    getState: () => AccountState;
    startLogin: () => Promise<AccountState>;
    cancelLogin: (attemptId: string) => Promise<AccountState>;
    refresh: () => Promise<AccountState>;
    logout: () => Promise<AccountState>;
    watch: (signal?: AbortSignal) => AsyncGenerator<AccountState>;
    dispose(): Promise<void>;
};
export type AccountController = ReturnType<typeof createAccountController>;
//# sourceMappingURL=account-controller.d.ts.map