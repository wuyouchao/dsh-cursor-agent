import {
  FileCredentialStore,
  Cursor,
  type SdkCredentialStore,
} from "@cursor/sdk";
import { randomUUID } from "node:crypto";
import type { AccountState } from "../shared/account.js";

export interface AccountControllerOptions {
  /** 仅用于离线 SDK 替身；生产 Cursor 的远端接口只读取官方默认凭据。 */
  store?: SdkCredentialStore;
  /** 仅用于离线 SDK 替身；生产环境以进程变量为准。 */
  hasEnvironmentKey?: () => boolean;
  timeoutMs?: number;
  disposeTimeoutMs?: number;
}
export function createAccountController(
  api: Pick<typeof Cursor, "auth" | "me" | "models">,
  options: AccountControllerOptions = {},
) {
  if (api === Cursor && (options.store || options.hasEnvironmentKey)) {
    throw new Error("真实 Cursor SDK 不支持覆盖认证存储或凭据来源检测。");
  }
  const store = options.store ?? new FileCredentialStore();
  const environment =
    options.hasEnvironmentKey ?? (() => Boolean(process.env.CURSOR_API_KEY));
  const timeoutMs = options.timeoutMs ?? 120_000;
  let state: AccountState = {
    status: "signed-out",
    credentialSource: "none",
    revision: 0,
    models: [],
  };
  let epoch = 0;
  let disposed = false;
  let disposal: Promise<void> | undefined;
  let active:
    | {
        id: string;
        abort: AbortController;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  let writes: Promise<void> = Promise.resolve();
  let writeFailed = false;
  const listeners = new Set<() => void>();
  const verifications = new Set<() => void>();
  const snapshot = () => structuredClone(state);
  function publish(next: Omit<AccountState, "revision">) {
    if (disposed) return;
    state = { ...next, revision: state.revision + 1 };
    for (const listener of listeners) listener();
  }
  function stop() {
    epoch++;
    for (const cancel of verifications) cancel();
    if (active) {
      clearTimeout(active.timer);
      active.abort.abort();
      active = undefined;
    }
  }
  function failure(code: string, message: string) {
    publish({
      status: "error",
      credentialSource: environment() ? "environment" : state.credentialSource,
      models: [],
      error: { code, message },
    });
  }
  function enqueue(action: () => Promise<void>) {
    const result = writes.then(action);
    writes = result.then(
      () => {
        writeFailed = false;
      },
      () => {
        writeFailed = true;
      },
    );
    return result;
  }
  async function verify(token: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
      const result = await Promise.race([
        new Promise<never>((_, reject) => {
          cancel = () => reject(new Error("stale"));
          verifications.add(cancel);
        }),
        (async (): Promise<Omit<AccountState, "revision">> => {
          await writes;
          if (token !== epoch || disposed)
            return {
              status: "signed-out",
              credentialSource: "none",
              models: [],
            };
          const local = await api.auth.status({ store });
          if (token !== epoch || disposed)
            return {
              status: "signed-out",
              credentialSource: "none",
              models: [],
            };
          const source = environment()
            ? "environment"
            : local.status === "logged-in"
              ? "saved"
              : "none";
          if (source === "none")
            return {
              status: "signed-out",
              credentialSource: source,
              models: [],
            };
          if (token === epoch && !disposed)
            publish({
              status: "verifying",
              credentialSource: source,
              models: [],
            });
          const [user, models] = await Promise.all([
            api.me(),
            api.models.list(),
          ]);
          return {
            status: "connected" as const,
            credentialSource: source,
            ...(user.userEmail === undefined ? {} : { email: user.userEmail }),
            ...(source === "saved" &&
            local.status === "logged-in" &&
            local.apiKeyExpiresAtMs !== undefined
              ? { apiKeyExpiresAtMs: local.apiKeyExpiresAtMs }
              : {}),
            models: models.map((model) => ({
              id: model.id,
              displayName: model.displayName,
              ...(model.parameters === undefined
                ? {}
                : {
                    parameters: model.parameters.map((p) => ({
                      id: p.id,
                      ...(p.displayName === undefined
                        ? {}
                        : { displayName: p.displayName }),
                      values: p.values.map((v) => ({
                        value: v.value,
                        ...(v.displayName === undefined
                          ? {}
                          : { displayName: v.displayName }),
                      })),
                    })),
                  }),
            })),
          };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      if (token === epoch && !disposed) publish(result);
    } catch {
      if (token === epoch && !disposed)
        failure("VERIFY_FAILED", "无法验证 Cursor 连接，请重试。");
    } finally {
      if (timer) clearTimeout(timer);
      if (cancel) verifications.delete(cancel);
    }
  }
  async function refresh() {
    if (disposed || active) return snapshot();
    stop();
    const token = epoch;
    publish({
      status: "verifying",
      credentialSource: environment() ? "environment" : state.credentialSource,
      models: [],
    });
    await verify(token);
    return snapshot();
  }
  async function startLogin() {
    if (disposed || active) return snapshot();
    stop();
    const token = epoch;
    const id = randomUUID();
    const abort = new AbortController();
    const timer = setTimeout(() => {
      if (token !== epoch) return;
      stop();
      failure("LOGIN_TIMEOUT", "登录等待已超时，请重新登录。");
    }, timeoutMs);
    active = { id, abort, timer };
    publish({
      status: "waiting",
      credentialSource: environment() ? "environment" : state.credentialSource,
      attemptId: id,
      models: [],
    });
    const guardedStore: SdkCredentialStore = {
      load: () => store.load(),
      clear: () => enqueue(() => store.clear()),
      save: (credentials) =>
        enqueue(async () => {
          if (token !== epoch || disposed || abort.signal.aborted) return;
          const previous = await store.load();
          if (token !== epoch || disposed || abort.signal.aborted) return;
          await store.save(credentials);
          // save 一旦进入官方存储便无法取消；在同一写队列内恢复先前凭据，
          // 后续登录和注销只会在恢复完成后写入，避免清除更新的登录。
          if (token !== epoch || disposed || abort.signal.aborted) {
            if (previous) await store.save(previous);
            else await store.clear();
          }
        }),
    };
    void (async () => {
      try {
        await api.auth.login({
          openBrowser: false,
          signal: abort.signal,
          store: guardedStore,
          apiKeyName: "DeepSeek Harness Cursor Plugin",
          onLoginUrl(url) {
            if (token !== epoch || disposed) return;
            const parsed = new URL(url);
            if (
              parsed.protocol !== "https:" ||
              (parsed.hostname !== "cursor.com" &&
                !parsed.hostname.endsWith(".cursor.com")) ||
              parsed.username ||
              parsed.password ||
              parsed.port
            )
              throw new Error("invalid login URL");
            publish({
              status: "waiting",
              credentialSource: environment()
                ? "environment"
                : state.credentialSource,
              attemptId: id,
              loginUrl: parsed.href,
              models: [],
            });
          },
        });
        if (token !== epoch || disposed) return;
        clearTimeout(timer);
        active = undefined;
        publish({
          status: "verifying",
          credentialSource: environment() ? "environment" : "saved",
          models: [],
        });
        await verify(token);
      } catch {
        if (token === epoch && !disposed) {
          clearTimeout(timer);
          active = undefined;
          failure("LOGIN_FAILED", "Cursor 登录未完成，请重新登录。");
        }
      }
    })();
    return snapshot();
  }
  async function cancelLogin(attemptId: string) {
    if (active?.id !== attemptId) return snapshot();
    stop();
    publish({
      status: "verifying",
      credentialSource: environment() ? "environment" : state.credentialSource,
      models: [],
    });
    await verify(epoch);
    return snapshot();
  }
  async function logout() {
    if (disposed) return snapshot();
    stop();
    const token = epoch;
    publish({
      status: "verifying",
      credentialSource: environment() ? "environment" : "none",
      models: [],
    });
    try {
      await enqueue(() => api.auth.logout({ store }));
      if (token === epoch) {
        publish({
          status: "signed-out",
          credentialSource: environment() ? "environment" : "none",
          models: [],
        });
        if (environment()) await verify(token);
      }
    } catch {
      if (token === epoch)
        failure("LOGOUT_FAILED", "无法清除 Cursor 保存的登录，请重试。");
    }
    return snapshot();
  }
  async function* watch(signal?: AbortSignal): AsyncGenerator<AccountState> {
    let wake: (() => void) | undefined;
    let dirty = true;
    const notify = () => {
      dirty = true;
      wake?.();
    };
    listeners.add(notify);
    signal?.addEventListener("abort", notify);
    try {
      while (!disposed && !signal?.aborted) {
        if (dirty) {
          dirty = false;
          yield snapshot();
        } else
          await new Promise<void>((resolve) => {
            wake = resolve;
            if (dirty || disposed || signal?.aborted) resolve();
          });
      }
    } finally {
      listeners.delete(notify);
      signal?.removeEventListener("abort", notify);
    }
  }
  return {
    getState: snapshot,
    startLogin,
    cancelLogin,
    refresh,
    logout,
    watch,
    dispose(): Promise<void> {
      if (disposal) return disposal;
      stop();
      disposed = true;
      for (const notify of listeners) notify();
      listeners.clear();
      disposal = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            writes,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    Object.assign(
                      new Error("Cursor 凭据清理未在期限内完成。"),
                      { code: "DISPOSE_TIMEOUT" },
                    ),
                  ),
                options.disposeTimeoutMs ?? 5_000,
              );
            }),
          ]);
          if (writeFailed)
            throw Object.assign(new Error("Cursor 凭据清理失败，请重试。"), {
              code: "DISPOSE_FAILED",
            });
        } finally {
          if (timer) clearTimeout(timer);
        }
      })();
      return disposal;
    },
  };
}
export type AccountController = ReturnType<typeof createAccountController>;
