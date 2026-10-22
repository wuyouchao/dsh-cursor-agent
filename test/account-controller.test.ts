import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryCredentialStore,
  Cursor,
  type SdkLoginOptions,
} from "@cursor/sdk";
import { createAccountController } from "../src/host/account-controller.js";

function fixture(environment = false, disposeTimeoutMs = 500) {
  const store = new InMemoryCredentialStore();
  let loginOptions: SdkLoginOptions | undefined;
  let complete: (() => Promise<void>) | undefined;
  let failRemote = false;
  const api: Pick<typeof Cursor, "auth" | "me" | "models"> = {
    auth: {
      async status() {
        const c = await store.load();
        return c
          ? {
              status: "logged-in",
              backendUrl: c.backendUrl,
              email: "saved@example.com",
            }
          : { status: "logged-out" };
      },
      async logout() {
        await store.clear();
      },
      login(options) {
        loginOptions = options;
        options?.onLoginUrl?.(
          "https://cursor.com/login?challenge=secret-challenge",
        );
        return new Promise((resolve) => {
          complete = async () => {
            await options?.store?.save({
              version: 1,
              backendUrl: "https://api.cursor.com",
              apiKey: "secret-key",
              createdAtMs: 1,
            });
            resolve({ apiKey: "secret-key", apiKeyExpiresAtMs: 10 });
          };
        });
      },
    },
    async me() {
      if (failRemote) throw new Error("secret-key raw error");
      return {
        apiKeyName: "private-key-name",
        userEmail: "actual@example.com",
        createdAt: "now",
      };
    },
    models: {
      async list() {
        return [{ id: "model", displayName: "模型" }];
      },
    },
  };
  const controller = createAccountController(api, {
    store,
    hasEnvironmentKey: () => environment,
    timeoutMs: 200,
    disposeTimeoutMs,
  });
  return {
    api,
    controller,
    store,
    get options() {
      return loginOptions;
    },
    finish: () => complete!(),
    fail: () => {
      failRemote = true;
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

test("同一控制器复用等待登录；成功后只公开安全状态", async () => {
  const f = fixture();
  try {
    const first = await f.controller.startLogin();
    assert.equal((await f.controller.startLogin()).attemptId, first.attemptId);
    assert.equal(f.options?.openBrowser, false);
    await f.finish();
    await settle();
    assert.equal(f.controller.getState().status, "connected");
    assert.equal(f.controller.getState().email, "actual@example.com");
    assert.doesNotMatch(
      JSON.stringify(f.controller.getState()),
      /secret-key|private-key-name|challenge/,
    );
  } finally {
    f.controller.dispose();
  }
});
test("取消、注销后的晚成功不能重新保存凭据或覆盖状态", async () => {
  const f = fixture();
  try {
    const first = await f.controller.startLogin();
    await f.controller.cancelLogin(first.attemptId!);
    assert.equal(f.options?.signal?.aborted, true);
    await f.controller.logout();
    await f.finish();
    await settle();
    assert.equal(await f.store.load(), undefined);
    assert.equal(f.controller.getState().status, "signed-out");
  } finally {
    f.controller.dispose();
  }
});
test("环境密钥覆盖保存账号，退出后仍准确显示环境连接", async () => {
  const f = fixture(true);
  try {
    await f.controller.refresh();
    assert.equal(f.controller.getState().credentialSource, "environment");
    assert.equal(f.controller.getState().email, "actual@example.com");
    await f.controller.logout();
    assert.equal(f.controller.getState().status, "connected");
    assert.equal(f.controller.getState().credentialSource, "environment");
    f.fail();
    await f.controller.refresh();
    assert.equal(f.controller.getState().error?.code, "VERIFY_FAILED");
    assert.doesNotMatch(
      JSON.stringify(f.controller.getState()),
      /secret-key|raw error/,
    );
  } finally {
    f.controller.dispose();
  }
});
test("watch取消会结束挂起订阅；dispose不等待SDK完成", async () => {
  const f = fixture();
  const abort = new AbortController();
  const iterator = f.controller.watch(abort.signal)[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value?.status, "signed-out");
  const pending = iterator.next();
  abort.abort();
  assert.equal((await pending).done, true);
  await f.controller.startLogin();
  f.controller.dispose();
  assert.equal(f.options?.signal?.aborted, true);
});
test("超时后SDK晚完成不能保存凭据", async () => {
  const f = fixture();
  try {
    await f.controller.startLogin();
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(f.controller.getState().error?.code, "LOGIN_TIMEOUT");
    await f.finish();
    await settle();
    assert.equal(await f.store.load(), undefined);
    assert.equal(f.controller.getState().error?.code, "LOGIN_TIMEOUT");
  } finally {
    f.controller.dispose();
  }
});

test("拒绝非官方登录链接，错误不回显链接或SDK异常", async () => {
  const f = fixture();
  f.api.auth.login = async (options) => {
    options?.onLoginUrl?.("javascript:alert('secret-key')");
    throw new Error("secret-key");
  };
  try {
    await f.controller.startLogin();
    await settle();
    assert.equal(f.controller.getState().error?.code, "LOGIN_FAILED");
    assert.doesNotMatch(
      JSON.stringify(f.controller.getState()),
      /javascript|secret-key/,
    );
  } finally {
    f.controller.dispose();
  }
});

test("注销使尚未完成的远端验证失效", async () => {
  const f = fixture();
  await f.store.save({
    version: 1,
    backendUrl: "https://api.cursor.com",
    apiKey: "secret-key",
    createdAtMs: 1,
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.api.me = async () => {
    await pending;
    return { apiKeyName: "private", createdAt: "now" };
  };
  try {
    const refresh = f.controller.refresh();
    await settle();
    const logout = f.controller.logout();
    release();
    await Promise.all([refresh, logout]);
    assert.equal(f.controller.getState().credentialSource, "none");
    assert.equal(f.controller.getState().status, "signed-out");
  } finally {
    f.controller.dispose();
  }
});

test("保存过程中取消会恢复旧凭据，并保留原账号状态", async () => {
  const f = fixture();
  const previous = {
    version: 1 as const,
    backendUrl: "https://api.cursor.com",
    apiKey: "old-key",
    createdAtMs: 1,
  };
  await f.store.save(previous);
  const save = f.store.save.bind(f.store);
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let first = true;
  f.store.save = async (credentials) => {
    if (first) {
      first = false;
      entered();
      await pending;
    }
    await save(credentials);
  };
  try {
    const login = await f.controller.startLogin();
    const finish = f.finish();
    await started;
    const cancel = f.controller.cancelLogin(login.attemptId!);
    release();
    await Promise.all([finish, cancel]);
    await settle();
    assert.equal((await f.store.load())?.apiKey, "old-key");
    assert.equal(f.controller.getState().credentialSource, "saved");
    assert.equal(f.controller.getState().status, "connected");
  } finally {
    f.controller.dispose();
  }
});

test("保存过程中注销会在旧写及恢复后清除凭据", async () => {
  const f = fixture();
  const save = f.store.save.bind(f.store);
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.store.save = async (credentials) => {
    entered();
    await pending;
    await save(credentials);
  };
  try {
    await f.controller.startLogin();
    const finish = f.finish();
    await started;
    const logout = f.controller.logout();
    release();
    await Promise.all([finish, logout]);
    assert.equal(await f.store.load(), undefined);
    assert.equal(f.controller.getState().status, "signed-out");
  } finally {
    f.controller.dispose();
  }
});

test("本地保存登录远端失效仍保留saved来源，允许退出", async () => {
  const f = fixture();
  await f.store.save({
    version: 1,
    backendUrl: "https://api.cursor.com",
    apiKey: "expired",
    createdAtMs: 1,
  });
  try {
    f.fail();
    await f.controller.refresh();
    assert.equal(f.controller.getState().credentialSource, "saved");
    assert.equal(f.controller.getState().status, "error");
    await f.controller.logout();
    assert.equal(await f.store.load(), undefined);
  } finally {
    f.controller.dispose();
  }
});

test("旧保存取消与新登录交错时，新凭据在回滚后提交", async () => {
  const f = fixture();
  const save = f.store.save.bind(f.store);
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let first = true;
  f.store.save = async (credentials) => {
    if (first) {
      first = false;
      entered();
      await pending;
    }
    await save(credentials);
  };
  try {
    const old = await f.controller.startLogin();
    const oldFinish = f.finish();
    await started;
    const cancel = f.controller.cancelLogin(old.attemptId!);
    const next = await f.controller.startLogin();
    assert.notEqual(old.attemptId, next.attemptId);
    const newFinish = f.finish();
    release();
    await Promise.all([cancel, oldFinish, newFinish]);
    await settle();
    assert.equal((await f.store.load())?.apiKey, "secret-key");
    assert.equal(f.controller.getState().status, "connected");
  } finally {
    f.controller.dispose();
  }
});

test("watch主动早退后可继续刷新和重新订阅", async () => {
  const f = fixture();
  try {
    const first = f.controller.watch();
    await first.next();
    await first.return(undefined);
    await f.controller.refresh();
    const second = f.controller.watch();
    assert.equal((await second.next()).value?.status, "signed-out");
    await second.return(undefined);
  } finally {
    f.controller.dispose();
  }
});

test("dispose等待已开始保存及回滚，但不等待登录网络", async () => {
  const f = fixture();
  const save = f.store.save.bind(f.store);
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.store.save = async (credentials) => {
    entered();
    await pending;
    await save(credentials);
  };
  await f.controller.startLogin();
  const finish = f.finish();
  await started;
  let drained = false;
  const disposal = f.controller.dispose().then(() => {
    drained = true;
  });
  await settle();
  assert.equal(drained, false);
  release();
  await Promise.all([finish, disposal]);
  assert.equal(await f.store.load(), undefined);
});

test("dispose对挂起存储有界失败，晚写仍执行后台回滚", async () => {
  const f = fixture(false, 10);
  const save = f.store.save.bind(f.store);
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.store.save = async (credentials) => {
    entered();
    await pending;
    await save(credentials);
  };
  await f.controller.startLogin();
  const finish = f.finish();
  await started;
  await assert.rejects(f.controller.dispose(), {
    code: "DISPOSE_TIMEOUT",
    message: "Cursor 凭据清理未在期限内完成。",
  });
  release();
  await finish;
  await settle();
  assert.equal(await f.store.load(), undefined);
});

test("真实SDK禁止测试凭据存储覆盖，防止本地状态和远端账号不一致", () => {
  assert.throws(
    () =>
      createAccountController(Cursor, { store: new InMemoryCredentialStore() }),
    /不支持覆盖认证存储/,
  );
  assert.throws(
    () => createAccountController(Cursor, { hasEnvironmentKey: () => false }),
    /不支持覆盖认证存储/,
  );
});
