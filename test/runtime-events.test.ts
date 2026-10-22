import assert from "node:assert/strict";
import test from "node:test";
import {
  SessionId,
  SessionSeq,
  type SessionEventMap,
} from "@deepseek-ai/dsh-session";
import type { AssistantStreamFrame } from "@deepseek-ai/dsh-agent";
import {
  CursorEventProjector,
  type CursorEventProjectorOptions,
} from "../src/runtime/events.js";

function harness(flush: () => Promise<void> = async () => {}) {
  const frames: AssistantStreamFrame[] = [];
  const events: { type: string; data: unknown }[] = [];
  let revision = 0;
  const options: CursorEventProjectorOptions = {
    sessionId: SessionId("offline"),
    turn: 1,
    step: 1,
    model: "offline-model",
    nextRevision: () => ++revision,
    emit: (frame) => frames.push(frame),
    flush,
    append: <
      K extends
        "assistant/message" | "assistant/attempt" | "tool/call" | "tool/result",
    >(
      type: K,
      data: SessionEventMap[K],
    ) => {
      events.push({ type, data });
      return SessionSeq(events.length);
    },
  };
  return { frames, events, projector: new CursorEventProjector(options) };
}
const identity = { agent_id: "agent", run_id: "run" };

test("delta 与 final 只展示并持久化一次", async () => {
  const { projector, frames, events } = harness();
  projector.onDelta({ type: "text-delta", text: "你好" });
  projector.onMessage({
    ...identity,
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "你好世界" }],
    },
  });
  await projector.settle();
  const deltas = frames.flatMap((frame) =>
    frame.type === "chunk" && frame.chunk.type === "text-delta"
      ? [frame.chunk.text]
      : [],
  );
  assert.equal(deltas.join(""), "你好世界");
  assert.deepEqual(
    (events[0]!.data as SessionEventMap["assistant/message"]).message.content,
    [{ type: "text", text: "你好世界" }],
  );
});

test("committed end 等待磁盘 flush", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { projector, frames, events } = harness(() => gate);
  const settling = projector.settle({ fallbackText: "答复" });
  assert.equal(events.length, 1);
  assert.equal(
    frames.some((frame) => frame.type === "end"),
    false,
  );
  release();
  await settling;
  assert.equal(frames.at(-1)?.type, "end");
});

test("flush 失败只能发布 abandoned", async () => {
  const { projector, frames } = harness(async () => {
    throw new Error("disk");
  });
  await assert.rejects(projector.settle(), /disk/);
  assert.deepEqual(frames.at(-1)?.type === "end" && frames.at(-1), {
    ...frames.at(-1),
    outcome: { kind: "abandoned" },
  });
});

test("原生工具事件只记录一次 call/result", async () => {
  const { projector, events } = harness();
  const message = {
    ...identity,
    type: "tool_call" as const,
    call_id: "call",
    name: "shell",
    status: "completed" as const,
    args: { command: "不应执行" },
    result: "官方执行结果",
  };
  projector.onMessage(message);
  projector.onMessage(message);
  assert.deepEqual(
    events.map((event) => event.type),
    ["tool/call", "tool/result"],
  );
  await projector.settle();
});

test("分段 assistant 保持顺序且 thinking final 去重", async () => {
  const { projector, events } = harness();
  projector.onDelta({ type: "thinking-delta", text: "思考" });
  projector.onMessage({ ...identity, type: "thinking", text: "思考完毕" });
  projector.onDelta({ type: "text-delta", text: "第一段" });
  projector.onMessage({
    ...identity,
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "第一段" }] },
  });
  projector.onMessage({
    ...identity,
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "第二段" }] },
  });
  await projector.settle({ interrupted: true });
  const data = events[0]!.data as SessionEventMap["assistant/message"];
  assert.deepEqual(data.message.content, [
    { type: "reasoning", text: "思考完毕" },
    { type: "text", text: "第一段" },
    { type: "text", text: "第二段" },
  ]);
  assert.equal(data.interrupted, true);
});

test("final 与 delta 冲突时明确失败", () => {
  const { projector } = harness();
  projector.onDelta({ type: "text-delta", text: "前缀" });
  assert.throws(
    () =>
      projector.onMessage({
        ...identity,
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "不同内容" }],
        },
      }),
    /不一致/,
  );
});

test("终止时闭合缺失结果的原生工具并明确结果未知", async () => {
  const { projector, events } = harness();
  projector.onMessage({
    ...identity,
    type: "tool_call",
    call_id: "pending",
    name: "shell",
    status: "running",
  });
  await projector.settle({ interrupted: true });
  const result = events.find((event) => event.type === "tool/result")!
    .data as SessionEventMap["tool/result"];
  assert.equal(result.message.isError, true);
  assert.match(JSON.stringify(result.message.content), /未报告/);
});

test("跨通道延迟 final 消费历史增量前缀", async () => {
  const { projector, frames, events } = harness();
  projector.onDelta({ type: "thinking-delta", text: "思考一" });
  projector.onDelta({ type: "text-delta", text: "答复一" });
  projector.onDelta({ type: "thinking-delta", text: "思考二" });
  projector.onDelta({ type: "text-delta", text: "答复二" });
  projector.onMessage({ ...identity, type: "thinking", text: "思考一" });
  projector.onMessage({
    ...identity,
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "答复一" }] },
  });
  projector.onMessage({ ...identity, type: "thinking", text: "思考二" });
  projector.onMessage({
    ...identity,
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "答复二" }] },
  });
  await projector.settle();
  const content = (events.at(-1)!.data as SessionEventMap["assistant/message"])
    .message.content;
  assert.deepEqual(
    content.map((block) =>
      block.type === "text" || block.type === "reasoning" ? block.text : "",
    ),
    ["思考一", "答复一", "思考二", "答复二"],
  );
  assert.equal(
    frames.filter(
      (frame) =>
        frame.type === "chunk" &&
        (frame.chunk.type === "text-delta" ||
          frame.chunk.type === "reasoning-delta"),
    ).length,
    4,
  );
});

test("工具非JSON值规范化且usage只映射已声明字段", async () => {
  const { projector, events } = harness();
  const circular: Record<string, unknown> = { value: 1n, absent: undefined };
  circular.self = circular;
  projector.onMessage({
    ...identity,
    type: "tool_call",
    call_id: "json",
    name: "native",
    status: "completed",
    args: circular,
    result: [2n, undefined, circular],
  });
  const call = events[0]!.data as SessionEventMap["tool/call"];
  assert.deepEqual(JSON.parse(call.arguments), {
    value: { $bigint: "1" },
    absent: { $unsupported: "undefined" },
    self: { $unsupported: "circular" },
  });
  assert.doesNotThrow(() => JSON.stringify(events));
  projector.onMessage({
    ...identity,
    type: "usage",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 22,
      cacheReadTokens: 6,
      cacheWriteTokens: 1,
      reasoningTokens: 2,
    },
  });
  await projector.settle({ fallbackText: "答复" });
  const data = events.at(-1)!.data as SessionEventMap["assistant/message"];
  assert.deepEqual(data.usage, {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 22,
    cacheReadTokens: 6,
    cacheWriteTokens: 1,
    reasoningTokens: 2,
  });
});
