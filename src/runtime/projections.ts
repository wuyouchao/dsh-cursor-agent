// 基于 DeepSeek Harness 的 turnBoundary/inbox 协议折叠算法改写；许可见 THIRD_PARTY_NOTICES。
import type { Context } from "@deepseek-ai/cordis";
import type {
  TurnBoundaryProjection,
  InboxState,
  InboxWireState,
} from "@deepseek-ai/dsh-agent";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";
import { SessionSeq } from "@deepseek-ai/dsh-session";
import type { UserMessage } from "@deepseek-ai/dsh-session";
import { z } from "zod";

const seq = z.number().int().nonnegative().transform(SessionSeq);
const boundary: ProjectionDefinition<"turnBoundary", TurnBoundaryProjection> = {
  key: "turnBoundary",
  stateVersion: 2,
  stateSchema: z.object({
    openTurnStartSeq: seq.nullable(),
    lastStepStartSeq: seq.nullable(),
    lastStepBoundary: z
      .object({ kind: z.enum(["start", "end"]), seq })
      .nullable(),
    lastTurn: z.number().int().nonnegative(),
  }),
  init: () => ({
    openTurnStartSeq: null,
    lastStepStartSeq: null,
    lastStepBoundary: null,
    lastTurn: 0,
  }),
  apply(state, event) {
    if (event.type === "turn/start")
      return {
        ...state,
        openTurnStartSeq: event.seq,
        lastTurn: event.data.turn,
      };
    if (event.type === "turn/end") return { ...state, openTurnStartSeq: null };
    if (event.type === "step/start")
      return {
        ...state,
        lastStepStartSeq: event.seq,
        lastStepBoundary: { kind: "start", seq: event.seq },
      };
    if (event.type === "step/end")
      return { ...state, lastStepBoundary: { kind: "end", seq: event.seq } };
    return state;
  },
};
const inboxSchema = z.object({
  "next-turn": z.array(z.custom<UserMessage>()),
  "next-step": z.array(z.custom<UserMessage>()),
});
const inbox: ProjectionDefinition<"inbox", InboxState> & {
  wire: NonNullable<ProjectionDefinition<"inbox", InboxState>["wire"]>;
} = {
  key: "inbox",
  stateVersion: 1,
  stateSchema: inboxSchema,
  init: () => ({ "next-turn": [], "next-step": [] }),
  apply(state, event) {
    if (event.type !== "agent/inbox/spliced") return state;
    const { target, start, removedCount = 0, inserted } = event.data;
    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      start > state[target].length ||
      !Number.isSafeInteger(removedCount) ||
      removedCount < 0 ||
      start + removedCount > state[target].length
    )
      throw new Error("Cursor待处理消息持久化索引不合法");
    const next = {
      ...state,
      [target]: state[target].toSpliced(start, removedCount, ...inserted),
    };
    const ids = [...next["next-turn"], ...next["next-step"]].map(
      (message) => message.id,
    );
    if (new Set(ids).size !== ids.length)
      throw new Error("Cursor待处理消息标识重复");
    return next;
  },
  wire: {
    viewSchema: inboxSchema as unknown as z.ZodType<InboxWireState>,
    view: (state) => state as unknown as InboxWireState,
  },
};
export function registerRuntimeProjections(ctx: Context): () => void {
  const removeBoundary = ctx.sessionProjections.register(boundary);
  try {
    const removeInbox = ctx.sessionProjections.register(inbox);
    return () => {
      removeInbox();
      removeBoundary();
    };
  } catch (error) {
    removeBoundary();
    throw error;
  }
}
