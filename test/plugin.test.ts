import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import plugin from "../src/index.js";

test("无需宿主全局执行服务即可激活独立账号与任务，并安全卸载", async () => {
  const root = await mkdtemp(join(tmpdir(), "cursor-independent-entry-"));
  const ctx = new Context();
  try {
    const fiber = ctx.plugin(plugin, { stateDirectory: root });
    await fiber.await();
    assert.equal(fiber.state, 2);
    assert.deepEqual(await ctx.cursorTasks.listTasks(), []);
    assert.equal(ctx.get("agents"), undefined);
    assert.equal(ctx.get("llm"), undefined);
    await fiber.dispose();
    assert.throws(() => ctx.cursorAccount.getState());
    assert.throws(() => ctx.cursorTasks.listTasks());
  } finally {
    await ctx.fiber.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
