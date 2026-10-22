import type { AccountState } from "../shared/account.js";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
export type AccountResult<T> = RemoteResult<T>;
export type AccountRemote = Pick<Context["remote"]["cursorAccount"], "getState" | "startLogin" | "cancelLogin" | "refresh" | "logout" | "watch">;
export interface AccountSnapshot {
    state?: AccountState;
    busy: boolean;
    error?: string | undefined;
}
/** 浏览器端仅持有安全账号快照；页面卸载只停止观察，不取消宿主登录。 */
export declare class CursorAccountStore {
    private readonly remote;
    private snapshot;
    private readonly listeners;
    private observer;
    private disposed;
    private consumers;
    private generation;
    constructor(remote: AccountRemote);
    readonly getSnapshot: () => AccountSnapshot;
    readonly subscribe: (listener: () => void) => (() => void);
    private publish;
    private accept;
    mount(): () => void;
    private run;
    readonly login: () => Promise<void>;
    readonly refresh: () => Promise<void>;
    readonly logout: () => Promise<void>;
    readonly cancel: (attemptId: string) => Promise<void>;
    readonly reset: () => void;
    dispose(): void;
}
//# sourceMappingURL=store.d.ts.map