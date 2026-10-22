import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlLocalAgentStore } from "@cursor/sdk";
import { cursorOptions } from "../src/runtime/index.js";
import {
  MappingStore,
  assertCheckpoint,
  canonicalWorkspace,
} from "../src/runtime/storage.js";
import type { AgentMapping } from "../src/runtime/storage.js";

test("固定store和映射跨实例恢复，缺少checkpoint明确失败", async () => {
  const root = await mkdtemp(join(tmpdir(), "cursor-storage-"));
  try {
    const workspace = await canonicalWorkspace(root);
    const mapping: AgentMapping = {
      schemaVersion: 1,
      sdkVersion: "1.0.40",
      sessionId: "恢复测试",
      agentId: "原生会话",
      workspace,
      storePath: join(root, "sdk"),
      permissionMode: "readonly",
      sandboxEnabled: true,
      model: { id: "准确模型id" },
    };
    await new MappingStore(join(root, "mapping")).put(mapping);
    assert.deepEqual(
      await new MappingStore(join(root, "mapping")).get(mapping.sessionId),
      mapping,
    );
    const store = new JsonlLocalAgentStore(mapping.storePath);
    await store.agents.create({
      agent: {
        agentId: mapping.agentId,
        cwd: workspace,
        status: "idle",
        createdAt: 1,
        updatedAt: 1,
        latestCheckpoint: { schemaVersion: 1, rootBlobId: "根" },
      },
    });
    await assert.rejects(assertCheckpoint(store, mapping), /checkpoint 缺失/);
    await store.checkpoints.create({
      agentId: mapping.agentId,
      blobId: "根",
      data: new Uint8Array([1, 2]),
    });
    await assertCheckpoint(
      new JsonlLocalAgentStore(mapping.storePath),
      mapping,
    );
    const readonly = cursorOptions(mapping, store);
    assert.equal(readonly.local?.sandboxOptions?.enabled, true);
    for (const unsafe of ["shell", "edit", "task", "mcp", "askQuestion"])
      assert.equal(readonly.tools?.includes(unsafe), false);
    assert.ok(
      cursorOptions(
        { ...mapping, permissionMode: "workspace-write" },
        store,
      ).tools?.includes("edit"),
    );
    assert.equal(
      cursorOptions(
        { ...mapping, permissionMode: "workspace-write" },
        store,
      ).tools?.includes("shell"),
      false,
    );
    assert.ok(
      cursorOptions(
        { ...mapping, permissionMode: "shell" },
        store,
      ).tools?.includes("shell"),
    );
    assert.ok(readonly.disallowedTools?.includes("task"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
