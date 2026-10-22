import type { Context } from "@deepseek-ai/cordis";
import {
  Remote,
  RemoteError,
  TypertRemoteService,
} from "@deepseek-ai/dsh-typert-protocol";
import { isAbsolute } from "node:path";
import type {
  CreateTaskInput,
  StandaloneRuntime,
  TaskMessage,
  TaskModel,
  TaskState,
  TaskSummary,
} from "../shared/tasks.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    cursorTasks: CursorTaskService;
  }
}
declare module "@deepseek-ai/dsh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    "cursor/task-failed": {};
    "cursor/task-busy": {};
  }
}

function valid(value: string, maximum = 512): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}
function summary(value: TaskSummary): TaskSummary {
  return {
    id: value.id,
    cwd: value.cwd,
    revision: value.revision,
    model: value.model,
    status: value.status,
    permissionMode: value.permissionMode,
    sandboxEnabled: value.sandboxEnabled,
    ...(value.attemptId === undefined ? {} : { attemptId: value.attemptId }),
  };
}
function message(value: TaskMessage): TaskMessage {
  return {
    id: value.id,
    role: value.role,
    text: value.text,
    ...(value.toolName === undefined ? {} : { toolName: value.toolName }),
    ...(value.toolStatus === undefined ? {} : { toolStatus: value.toolStatus }),
  };
}
/** Gateway 出站不保证 strip，因此此处逐字段构造真正送往客户端的值。 */
export function projectTaskState(value: TaskState): TaskState {
  return { ...summary(value), messages: value.messages.map(message) };
}

/** 独立 Cursor 任务域，不注册或覆盖宿主的全局模型、Agent 或会话。 */
export class CursorTaskService extends TypertRemoteService {
  private pending = 0;
  private watchers = 0;
  private readonly sending = new Set<string>();
  constructor(
    ctx: Context,
    private readonly runtime: StandaloneRuntime,
  ) {
    super(ctx, "cursorTasks");
  }
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pending >= 64)
      throw new RemoteError(
        "cursor/task-busy",
        "Cursor 请求过多，请稍后重试。",
        {},
      );
    this.pending++;
    try {
      return await operation();
    } catch {
      throw new RemoteError(
        "cursor/task-failed",
        "Cursor 任务操作未完成，请检查连接、工作区及任务状态后重试。",
        {},
      );
    } finally {
      this.pending--;
    }
  }
  private id(id: string) {
    if (!valid(id))
      throw new RemoteError("gateway/bad-request", "Cursor 任务标识无效。", {});
  }
  @Remote
  listModels(): Promise<TaskModel[]> {
    return this.call(async () =>
      (await this.runtime.listModels()).map((value) => ({
        id: value.id,
        name: value.name,
      })),
    );
  }
  @Remote
  listTasks(): Promise<TaskSummary[]> {
    return this.call(async () => (await this.runtime.listTasks()).map(summary));
  }
  @Remote
  create(input: CreateTaskInput): Promise<TaskState> {
    if (
      !input ||
      !valid(input.cwd, 32768) ||
      !isAbsolute(input.cwd) ||
      !valid(input.model, 32768)
    )
      throw new RemoteError(
        "gateway/bad-request",
        "请填写绝对工作区路径并选择 Cursor 模型。",
        {},
      );
    return this.call(async () =>
      projectTaskState(
        await this.runtime.create({ cwd: input.cwd, model: input.model }),
      ),
    );
  }
  @Remote
  resume(id: string): Promise<TaskState> {
    this.id(id);
    return this.call(async () =>
      projectTaskState(await this.runtime.resume(id)),
    );
  }
  @Remote
  send(id: string, text: string): Promise<TaskState> {
    this.id(id);
    if (!valid(text, 100_000) || !text.trim())
      throw new RemoteError(
        "gateway/bad-request",
        "请输入有效消息（最多十万字符）。",
        {},
      );
    if (this.sending.has(id))
      throw new RemoteError(
        "cursor/task-busy",
        "该 Cursor 任务仍在发送消息，请等待或取消。",
        {},
      );
    this.sending.add(id);
    return this.call(async () =>
      projectTaskState(await this.runtime.send(id, text)),
    ).finally(() => this.sending.delete(id));
  }
  @Remote
  cancel(id: string, attemptId: string): Promise<TaskState> {
    this.id(id);
    if (!valid(attemptId))
      throw new RemoteError("gateway/bad-request", "Cursor 运行标识无效。", {});
    return this.call(async () =>
      projectTaskState(await this.runtime.cancel(id, attemptId)),
    );
  }
  @Remote
  snapshot(id: string): Promise<TaskState> {
    this.id(id);
    return this.call(async () =>
      projectTaskState(await this.runtime.snapshot(id)),
    );
  }
  @Remote({ mode: "stream" })
  async *watch(id: string, signal: AbortSignal): AsyncIterable<TaskState> {
    this.id(id);
    if (this.watchers >= 64)
      throw new RemoteError(
        "cursor/task-busy",
        "Cursor 订阅过多，请关闭部分任务页面。",
        {},
      );
    this.watchers++;
    try {
      for await (const value of this.runtime.watch(id, signal)) {
        if (signal.aborted) return;
        yield projectTaskState(value);
      }
    } catch {
      if (!signal.aborted)
        throw new RemoteError(
          "cursor/task-failed",
          "Cursor 任务状态订阅中断，请重新打开任务。",
          {},
        );
    } finally {
      this.watchers--;
    }
  }
}
