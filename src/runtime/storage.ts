import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LocalAgentStore, ModelSelection } from "@cursor/sdk";

export interface AgentMapping {
  schemaVersion: 1;
  sdkVersion: "1.0.40";
  sessionId: string;
  agentId: string;
  workspace: string;
  storePath: string;
  permissionMode: "readonly" | "workspace-write" | "shell";
  sandboxEnabled: boolean;
  model: ModelSelection;
}

export async function canonicalWorkspace(path: string): Promise<string> {
  const canonical = await realpath(resolve(path));
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

/** 与 SDK checkpoint 分离的公开映射；不保存任何凭据。 */
export class MappingStore {
  constructor(readonly root: string) {}
  private path(id: string) {
    return join(
      this.root,
      `${createHash("sha256").update(id).digest("hex")}.json`,
    );
  }
  async put(mapping: AgentMapping): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = this.path(mapping.sessionId);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(mapping), { mode: 0o600 });
    await rename(temporary, target);
  }
  async get(id: string): Promise<AgentMapping> {
    const raw: unknown = JSON.parse(await readFile(this.path(id), "utf8"));
    if (!raw || typeof raw !== "object") throw new Error("Cursor 会话映射损坏");
    const mapping = raw as AgentMapping;
    if (
      mapping.schemaVersion !== 1 ||
      mapping.sdkVersion !== "1.0.40" ||
      mapping.sessionId !== id ||
      typeof mapping.agentId !== "string" ||
      mapping.agentId.length === 0 ||
      typeof mapping.workspace !== "string" ||
      typeof mapping.storePath !== "string" ||
      !["readonly", "workspace-write", "shell"].includes(
        mapping.permissionMode,
      ) ||
      typeof mapping.sandboxEnabled !== "boolean" ||
      typeof mapping.model?.id !== "string"
    )
      throw new Error("Cursor 会话映射版本或内容不兼容");
    return mapping;
  }
}

export async function assertCheckpoint(
  store: LocalAgentStore,
  mapping: AgentMapping,
): Promise<void> {
  const row = await store.agents.get({ agentId: mapping.agentId });
  if (!row || (await canonicalWorkspace(row.cwd)) !== mapping.workspace)
    throw new Error("Cursor Agent 缺失或工作区不匹配，无法恢复");
  const blobId = row.latestCheckpoint?.rootBlobId;
  if (
    !blobId ||
    !(await store.checkpoints.get({ agentId: mapping.agentId, blobId }))
  )
    throw new Error("Cursor checkpoint 缺失，拒绝创建空会话冒充恢复");
  if (row.activeRunId)
    throw new Error("Cursor 存在未结束的运行；本版不自动接管崩溃中的运行");
}
