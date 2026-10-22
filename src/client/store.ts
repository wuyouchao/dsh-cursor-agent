import type { AccountState } from "../shared/account.js";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type { Context } from "@deepseek-ai/cordis";
import type {} from "../remote.js";

export type AccountResult<T> = RemoteResult<T>;
export type AccountRemote = Pick<
  Context["remote"]["cursorAccount"],
  "getState" | "startLogin" | "cancelLogin" | "refresh" | "logout" | "watch"
>;
export interface AccountSnapshot {
  state?: AccountState;
  busy: boolean;
  error?: string | undefined;
}

/** 浏览器端仅持有安全账号快照；页面卸载只停止观察，不取消宿主登录。 */
export class CursorAccountStore {
  private snapshot: AccountSnapshot = { busy: false };
  private readonly listeners = new Set<() => void>();
  private observer: AbortController | undefined;
  private disposed = false;
  private consumers = 0;
  private generation = 0;
  constructor(private readonly remote: AccountRemote) {}
  readonly getSnapshot = (): AccountSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: AccountSnapshot): void {
    if (this.disposed) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
  private accept(state: AccountState): void {
    if (this.snapshot.state && state.revision < this.snapshot.state.revision)
      return;
    this.publish({ state, busy: this.snapshot.busy });
  }
  mount(): () => void {
    if (this.disposed) return () => {};
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
        } catch {
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
      if (!mounted) return;
      mounted = false;
      if (--this.consumers === 0) {
        this.observer?.abort();
        this.observer = undefined;
      }
    };
  }
  private async run(
    operation: () => Promise<AccountResult<AccountState>>,
  ): Promise<void> {
    if (this.snapshot.busy || this.disposed) return;
    const generation = this.generation;
    this.publish({ ...this.snapshot, busy: true, error: undefined });
    try {
      const result = await operation();
      if (generation !== this.generation) return;
      if (result.ok && result.value) this.accept(result.value);
      else this.publish({ ...this.snapshot, error: "账号操作失败，请重试。" });
    } catch {
      if (generation === this.generation)
        this.publish({ ...this.snapshot, error: "无法连接账号服务，请重试。" });
    } finally {
      if (generation === this.generation)
        this.publish({ ...this.snapshot, busy: false });
    }
  }
  readonly login = (): Promise<void> =>
    this.run(() => this.remote.startLogin());
  readonly refresh = (): Promise<void> => {
    // 手动刷新也重建观察连接，使断线后能继续收到浏览器授权结果。
    if (this.consumers > 0 && !this.snapshot.busy && !this.disposed) {
      this.observer?.abort();
      this.observer = undefined;
      const release = this.mount();
      release();
    }
    return this.run(() => this.remote.refresh());
  };
  readonly logout = (): Promise<void> => this.run(() => this.remote.logout());
  readonly cancel = (attemptId: string): Promise<void> =>
    this.run(() => this.remote.cancelLogin(attemptId));
  readonly reset = (): void => {
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
  dispose(): void {
    this.disposed = true;
    this.observer?.abort();
    this.observer = undefined;
    this.listeners.clear();
  }
}
