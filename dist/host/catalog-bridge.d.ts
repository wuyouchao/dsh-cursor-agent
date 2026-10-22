import type { AccountState } from "../shared/account.js";
export interface AccountCatalogSource {
    watch(signal: AbortSignal): AsyncIterable<AccountState>;
}
/** 与入口 getModels 的可见投影一致；验证期间清空、回连恢复都必须通知。 */
export declare function watchAccountCatalog(account: AccountCatalogSource, changed: () => void, signal: AbortSignal): Promise<void>;
//# sourceMappingURL=catalog-bridge.d.ts.map