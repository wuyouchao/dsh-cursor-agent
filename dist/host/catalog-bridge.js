/** 登录中间态和重复快照不刷新目录；真正连接、退出或目录变化才通知。 */
export async function watchAccountCatalog(account, changed, signal) {
    let previous;
    for await (const state of account.watch(signal)) {
        if (signal.aborted)
            return;
        if (state.status === "waiting" || state.status === "verifying")
            continue;
        const signature = state.status === "connected" ? JSON.stringify(state.models) : "";
        if (previous !== undefined && previous !== signature)
            changed();
        previous = signature;
    }
}
//# sourceMappingURL=catalog-bridge.js.map