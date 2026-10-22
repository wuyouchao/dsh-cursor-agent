import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import plugin from "../src/index.js";

test("账号服务可独立激活，缺少官方聊天服务时不伪注册模型或创建任务", async () => {
  const ctx = new Context();
  try {
    const fiber = ctx.plugin(plugin);
    await fiber.await();
    assert.equal(fiber.state, 2);
    assert.equal(ctx.cursorAccount.getState().status, "signed-out");
    assert.equal(ctx.get("llm"), undefined);
    assert.equal(ctx.get("cursorTasks"), undefined);
    await fiber.dispose();
    assert.throws(() => ctx.cursorAccount.getState());
  } finally {
    await ctx.fiber.dispose();
  }
});
