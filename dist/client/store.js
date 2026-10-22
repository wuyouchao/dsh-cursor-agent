/** 浏览器端仅持有安全账号快照；页面卸载只停止观察，不取消宿主登录。 */
export class CursorAccountStore {
    remote;
    snapshot = { busy: false };
    listeners = new Set();
    observer;
    disposed = false;
    consumers = 0;
    generation = 0;
    constructor(remote) {
        this.remote = remote;
    }
    getSnapshot = () => this.snapshot;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    publish(next) {
        if (this.disposed)
            return;
        this.snapshot = next;
        for (const listener of this.listeners)
            listener();
    }
    accept(state) {
        if (this.snapshot.state && state.revision < this.snapshot.state.revision)
            return;
        this.publish({ state, busy: this.snapshot.busy });
    }
    mount() {
        if (this.disposed)
            return () => { };
        this.consumers++;
        if (!this.observer) {
            const observer = new AbortController();
            const generation = this.generation;
            this.observer = observer;
            void (async () => {
                try {
                    for await (const state of this.remote.watch(observer.signal)) {
                        if (observer.signal.aborted || generation !== this.generation)
                            return;
                        this.accept(state);
                    }
                    if (!observer.signal.aborted)
                        this.publish({
                            ...this.snapshot,
                            error: "账号状态连接已断开，请刷新重试。",
                        });
                }
                catch {
                    if (!observer.signal.aborted)
                        this.publish({
                            ...this.snapshot,
                            error: "无法读取账号状态，请刷新重试。",
                        });
                }
            })();
        }
        let mounted = true;
        return () => {
            if (!mounted)
                return;
            mounted = false;
            if (--this.consumers === 0) {
                this.observer?.abort();
                this.observer = undefined;
            }
        };
    }
    async run(operation) {
        if (this.snapshot.busy || this.disposed)
            return;
        const generation = this.generation;
        this.publish({ ...this.snapshot, busy: true, error: undefined });
        try {
            const result = await operation();
            if (generation !== this.generation)
                return;
            if (result.ok && result.value)
                this.accept(result.value);
            else
                this.publish({ ...this.snapshot, error: "账号操作失败，请重试。" });
        }
        catch {
            if (generation === this.generation)
                this.publish({ ...this.snapshot, error: "无法连接账号服务，请重试。" });
        }
        finally {
            if (generation === this.generation)
                this.publish({ ...this.snapshot, busy: false });
        }
    }
    login = () => this.run(() => this.remote.startLogin());
    refresh = () => {
        // 手动刷新也重建观察连接，使断线后能继续收到浏览器授权结果。
        if (this.consumers > 0 && !this.snapshot.busy && !this.disposed) {
            this.observer?.abort();
            this.observer = undefined;
            const release = this.mount();
            release();
        }
        return this.run(() => this.remote.refresh());
    };
    logout = () => this.run(() => this.remote.logout());
    cancel = (attemptId) => this.run(() => this.remote.cancelLogin(attemptId));
    reset = () => {
        this.generation++;
        this.observer?.abort();
        this.observer = undefined;
        this.publish({ busy: false });
        if (this.consumers > 0) {
            const release = this.mount();
            release();
            void this.refresh();
        }
    };
    dispose() {
        this.disposed = true;
        this.observer?.abort();
        this.observer = undefined;
        this.listeners.clear();
    }
}
//# sourceMappingURL=store.js.map