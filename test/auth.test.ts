import assert from "node:assert/strict";
import test from "node:test";
import type { SdkCredentialStore, SdkLoginOptions } from "@cursor/sdk";
import {
  createCursorAuth,
  DEFAULT_API_KEY_NAME,
  type CursorAuthApi,
} from "../src/cursor/auth.js";

function mockAuth(overrides: Partial<CursorAuthApi> = {}): CursorAuthApi {
  return {
    login: async () => ({
      apiKey: "mock-secret-must-not-escape",
      email: "example@example.com",
      apiKeyExpiresAtMs: 1_800_000_000_000,
    }),
    status: async () => ({ status: "logged-out" }),
    logout: async () => {},
    ...overrides,
  };
}

test("登录仅返回可展示字段，不泄露 API key", async () => {
  const result = await createCursorAuth(mockAuth()).login();
  assert.deepEqual(result, {
    status: "logged-in",
    email: "example@example.com",
    apiKeyExpiresAtMs: 1_800_000_000_000,
  });
  assert.equal("apiKey" in result, false);
  assert.equal(JSON.stringify(result).includes("mock-secret"), false);
});

test("登录转发取消信号和链接回调，并给生成的 key 命名", async () => {
  const controller = new AbortController();
  const urls: string[] = [];
  const onLoginUrl = (url: string) => urls.push(url);
  let captured: SdkLoginOptions | undefined;
  const api = mockAuth({
    login: async (options) => {
      captured = options;
      options?.onLoginUrl?.("https://cursor.com/mock-login");
      return { apiKey: "hidden", apiKeyExpiresAtMs: 1_800_000_000_000 };
    },
  });

  const result = await createCursorAuth(api).login({
    signal: controller.signal,
    openBrowser: false,
    onLoginUrl,
  });
  assert.equal(captured?.signal, controller.signal);
  assert.equal(captured?.openBrowser, false);
  assert.equal(captured?.onLoginUrl, onLoginUrl);
  assert.equal(captured?.apiKeyName, DEFAULT_API_KEY_NAME);
  assert.deepEqual(urls, ["https://cursor.com/mock-login"]);
  assert.equal("email" in result, false);
  controller.abort();
  assert.equal(captured?.signal?.aborted, true);
});

test("登录保留调用方命名，并传播 SDK 取消错误", async () => {
  const controller = new AbortController();
  const cancelled = new Error("模拟 SDK 取消登录");
  const api = mockAuth({
    login: (options) => {
      assert.equal(options?.apiKeyName, "自定义名称");
      return new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(cancelled), {
          once: true,
        });
      });
    },
  });
  const pending = createCursorAuth(api).login({
    apiKeyName: "自定义名称",
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error === cancelled);
});

test("状态返回官方安全字段，并转发存储配置", async () => {
  const store: SdkCredentialStore = {
    load: async () => undefined,
    save: async () => {},
    clear: async () => {},
  };
  const expected = {
    status: "logged-in" as const,
    backendUrl: "https://api.cursor.com",
    email: "example@example.com",
    apiKeyExpiresAtMs: 1_800_000_000_000,
  };
  const api = mockAuth({
    status: async (options) => {
      assert.equal(options?.store, store);
      return expected;
    },
  });
  assert.deepEqual(await createCursorAuth(api).status({ store }), expected);
  assert.deepEqual(await createCursorAuth(mockAuth()).status(), {
    status: "logged-out",
  });
});

test("退出登录调用官方接口并传播错误", async () => {
  let calls = 0;
  const failure = new Error("模拟凭据存储失败");
  const api = mockAuth({
    logout: async () => {
      calls += 1;
      if (calls === 2) throw failure;
    },
  });
  const auth = createCursorAuth(api);
  await auth.logout();
  assert.equal(calls, 1);
  await assert.rejects(auth.logout(), (error: unknown) => error === failure);
  assert.equal(calls, 2);
});
