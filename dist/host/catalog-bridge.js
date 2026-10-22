/** 与入口 getModels 的可见投影一致；验证期间清空、回连恢复都必须通知。 */
export async function watchAccountCatalog(account, changed, signal) {
    let previous;
    for await (const state of account.watch(signal)) {
        if (signal.aborted)
            return;
        const signature = JSON.stringify(state.status === "connected" ? state.models : []);
        if (previous !== undefined && previous !== signature)
            changed();
        previous = signature;
    }
}
//# sourceMappingURL=catalog-bridge.js.map