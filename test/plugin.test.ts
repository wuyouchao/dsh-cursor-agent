import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import plugin from "../src/index.js";

test("缺依赖时可安全等待和卸载", async () => {
  const ctx = new Context();
  try {
    const fiber = ctx.plugin(plugin);
    await fiber.await();
    assert.doesNotThrow(() => fiber.assertActive());
    await fiber.dispose();
    assert.throws(() => fiber.assertActive(), { code: "INACTIVE_EFFECT" });
  } finally {
    await ctx.fiber.dispose();
  }
});
