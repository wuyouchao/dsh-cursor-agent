import type { AccountState } from "../shared/account.js";
export interface AccountCatalogSource {
    watch(signal: AbortSignal): AsyncIterable<AccountState>;
}
/** 登录中间态和重复快照不刷新目录；真正连接、退出或目录变化才通知。 */
export declare function watchAccountCatalog(account: AccountCatalogSource, changed: () => void, signal: AbortSignal): Promise<void>;
//# sourceMappingURL=catalog-bridge.d.ts.map