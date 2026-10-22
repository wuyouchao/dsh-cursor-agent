import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type { AccountState } from "../shared/account.js";
declare module "@deepseek-ai/cordis" {
    interface Context {
        cursorAccount: CursorAccountService;
    }
}
/** 仅暴露安全账号快照，凭据始终由 Cursor SDK 管理。 */
export declare class CursorAccountService extends TypertRemoteService {
    private readonly controller;
    constructor(ctx: Context);
    getState(): AccountState;
    startLogin(): Promise<AccountState>;
    cancelLogin(attemptId: string): Promise<AccountState>;
    refresh(): Promise<AccountState>;
    logout(): Promise<AccountState>;
    watch(signal: AbortSignal): AsyncIterable<AccountState>;
}
//# sourceMappingURL=remote-service.d.ts.map