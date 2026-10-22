import test from "node:test";
import assert from "node:assert/strict";
import { copyLoginUrl, safeLoginUrl } from "../src/client/browser.js";

test("认证链接仅接受官方HTTPS域且没有凭据和自定义端口", () => {
  assert.equal(
    safeLoginUrl("https://cursor.com/login"),
    "https://cursor.com/login",
  );
  assert.equal(
    safeLoginUrl("https://auth.cursor.com/login"),
    "https://auth.cursor.com/login",
  );
  for (const url of [
    "http://cursor.com/login",
    "https://cursor.com.evil.invalid/",
    "https://evilcursor.com/",
    "https://user:pass@cursor.com/",
    "https://cursor.com:444/",
    "javascript:alert(1)",
    "invalid",
  ])
    assert.equal(safeLoginUrl(url), undefined);
});
test("复制链接处理成功、缺失剪贴板及同步和异步拒绝", async () => {
  let copied = "";
  assert.equal(
    await copyLoginUrl("fixture", {
      writeText: async (value) => {
        copied = value;
      },
    }),
    "链接已复制",
  );
  assert.equal(copied, "fixture");
  const failed = "复制失败，请使用“打开浏览器”。";
  assert.equal(await copyLoginUrl("fixture", undefined), failed);
  assert.equal(
    await copyLoginUrl("fixture", {
      writeText() {
        throw new Error("fixture");
      },
    }),
    failed,
  );
  assert.equal(
    await copyLoginUrl("fixture", {
      writeText: async () => {
        throw new Error("fixture");
      },
    }),
    failed,
  );
});
