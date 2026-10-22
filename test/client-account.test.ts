import assert from "node:assert/strict";
import test from "node:test";
import { CursorAccountStore } from "../src/client/store.js";
import type { AccountRemote } from "../src/client/store.js";
import type { AccountState } from "../src/shared/account.js";

const signedOut: AccountState = {
  status: "signed-out",
  credentialSource: "none",
  revision: 0,
  models: [],
};
function fixture() {
  let signal: AbortSignal | undefined;
  let cancelled: string | undefined;
  let watches = 0;
  let resolveLogin:
    ((value: { ok: true; value: AccountState }) => void) | undefined;
  const remote: AccountRemote = {
    getState: async () => ({ ok: true, value: signedOut }),
    refresh: async () => ({ ok: true, value: { ...signedOut, revision: 2 } }),
    logout: async () => ({ ok: true, value: signedOut }),
    startLogin: () =>
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    cancelLogin: async (id) => {
      cancelled = id;
      return { ok: true, value: signedOut };
    },
    watch(nextSignal) {
      watches++;
      return {
        send() {},
        end() {},
        dispose() {},
        async *[Symbol.asyncIterator]() {
          signal = nextSignal;
          yield signedOut;
          await new Promise<void>((resolve) =>
            nextSignal?.addEventListener("abort", () => resolve(), {
              once: true,
            }),
          );
        },
      };
    },
  };
  return {
    store: new CursorAccountStore(remote),
    signal: () => signal,
    cancelled: () => cancelled,
    watches: () => watches,
    complete: (state: AccountState) =>
      resolveLogin?.({ ok: true, value: state }),
  };
}
test("页面卸载停止观察，不取消任何登录；重复清理安全", async () => {
  const f = fixture();
  const unmount = f.store.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.store.getSnapshot().state?.status, "signed-out");
  unmount();
  unmount();
  assert.equal(f.signal()?.aborted, true);
  assert.equal(f.cancelled(), undefined);
});
test("Cursor 独立设置页和模型页共用观察，最后一个页面卸载才停止", async () => {
  const f = fixture();
  const closeCursor = f.store.mount();
  const closeModels = f.store.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.watches(), 1);
  closeCursor();
  assert.equal(f.signal()?.aborted, false);
  closeModels();
  assert.equal(f.signal()?.aborted, true);
});
test("显式取消始终发送点击时的 attemptId", async () => {
  const f = fixture();
  await f.store.cancel("own-attempt");
  assert.equal(f.cancelled(), "own-attempt");
});
test("旧操作响应不会覆盖新版本状态", async () => {
  const f = fixture();
  await f.store.refresh();
  const login = f.store.login();
  f.complete({
    ...signedOut,
    status: "waiting",
    revision: 1,
    attemptId: "old",
  });
  await login;
  assert.equal(f.store.getSnapshot().state?.revision, 2);
});
test("卸载插件后忽略尚未完成的操作", async () => {
  const f = fixture();
  const pending = f.store.login();
  f.store.dispose();
  const snapshot = f.store.getSnapshot();
  f.complete({ ...signedOut, status: "connected", revision: 3 });
  await pending;
  assert.equal(f.store.getSnapshot(), snapshot);
});
test("Host 重启后接受归零 revision，旧代操作不能污染新状态", async () => {
  const f = fixture();
  await f.store.refresh();
  const pending = f.store.login();
  f.store.reset();
  const unmount = f.store.mount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.store.getSnapshot().state?.revision, 0);
  f.complete({ ...signedOut, status: "connected", revision: 99 });
  await pending;
  assert.equal(f.store.getSnapshot().state?.revision, 0);
  unmount();
});
