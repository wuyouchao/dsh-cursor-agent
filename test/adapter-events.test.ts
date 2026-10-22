import assert from "node:assert/strict";
import test from "node:test";
import { ToolCallId, type StreamChunk } from "@deepseek-ai/dsh-llm";
import { AdapterEventProjector } from "../src/adapter/events.js";

const identity = { agent_id: "offline", run_id: "offline" };
const assistant = (text: string) => ({
  ...identity,
  type: "assistant" as const,
  message: {
    role: "assistant" as const,
    content: [{ type: "text" as const, text }],
  },
});
const displayed = (chunks: StreamChunk[]) =>
  chunks
    .flatMap((chunk) =>
      chunk.type === "text-delta" || chunk.type === "reasoning-delta"
        ? [chunk.text]
        : [],
    )
    .join("");

test("增量与 final 补齐后仅展示一次，不追加 result 汇总", () => {
  const projector = new AdapterEventProjector();
  const chunks = [
    ...projector.onDelta({ type: "text-delta", text: "你好" }),
    ...projector.onMessage(assistant("你好世界")),
    ...projector.finish(
      { kind: "stop" },
      { id: "offline", status: "finished", result: "你好世界" },
    ),
  ];
  assert.equal(displayed(chunks), "你好世界");
  assert.equal(chunks.filter((chunk) => chunk.type === "block-end").length, 1);
});

test("跨通道迟到 final 按各自未确认前缀去重", () => {
  const projector = new AdapterEventProjector();
  const chunks: StreamChunk[] = [];
  for (const update of [
    { type: "thinking-delta", text: "思考一" },
    { type: "text-delta", text: "答复一" },
    { type: "thinking-delta", text: "思考二" },
    { type: "text-delta", text: "答复二" },
  ] as const)
    chunks.push(...projector.onDelta(update));
  chunks.push(
    ...projector.onMessage({ ...identity, type: "thinking", text: "思考一" }),
  );
  chunks.push(...projector.onMessage(assistant("答复一")));
  chunks.push(
    ...projector.onMessage({ ...identity, type: "thinking", text: "思考二" }),
  );
  chunks.push(...projector.onMessage(assistant("答复二")));
  chunks.push(...projector.finish({ kind: "stop" }));
  assert.equal(displayed(chunks), "思考一答复一思考二答复二");
  assert.deepEqual(
    chunks
      .filter((chunk) => chunk.type === "block-start")
      .map((chunk) => chunk.index),
    [0, 1, 2, 3],
  );
});

test("内部 MCP 工具事件被忽略，显式工具请求闭合文本且索引连续", () => {
  const projector = new AdapterEventProjector();
  projector.onDelta({ type: "text-delta", text: "调用" });
  assert.deepEqual(
    projector.onMessage({
      ...identity,
      type: "tool_call",
      call_id: "internal",
      name: "mcp__harness",
      status: "running",
    }),
    [],
  );
  const chunks = projector.appendTools([
    { id: ToolCallId("call"), name: "read", arguments: "{}" },
  ]);
  assert.equal(chunks[0]?.type, "block-end");
  assert.equal(chunks[1]?.type === "block-start" && chunks[1].index, 1);
  assert.equal(projector.nextBlockIndex, 2);
  assert.deepEqual(projector.finish({ kind: "tool-calls" }).at(-1), {
    type: "finish",
    reason: { kind: "tool-calls" },
  });
});

test("usage 只映射已声明字段并优先使用终态 usage", () => {
  const projector = new AdapterEventProjector();
  projector.onMessage({
    ...identity,
    type: "usage",
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  });
  const usage = {
    inputTokens: 3,
    outputTokens: 4,
    totalTokens: 7,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 1,
    secret: "不得泄漏",
  };
  const chunks = projector.finish(
    { kind: "stop" },
    { id: "offline", status: "finished", usage },
  );
  assert.deepEqual(chunks[0], {
    type: "usage",
    usage: {
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 1,
    },
  });
  assert.throws(() => projector.onMessage(assistant("迟到")), /已结束/);
});

test("不一致 final 明确失败，空 final 不消费已有增量", () => {
  const projector = new AdapterEventProjector();
  projector.onDelta({ type: "text-delta", text: "前缀" });
  assert.deepEqual(projector.onMessage(assistant("")), []);
  assert.throws(() => projector.onMessage(assistant("不同")), /不一致/);
  assert.equal(
    projector.onMessage(assistant("前缀")).at(-1)?.type,
    "block-end",
  );
});
