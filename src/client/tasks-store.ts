import type { Context } from "@deepseek-ai/cordis";
import type { RemoteResult } from "@deepseek-ai/dsh-typert-protocol";
import type {} from "../remote.js";
import type {
  CreateTaskInput,
  TaskModel,
  TaskState,
  TaskSummary,
} from "../shared/tasks.js";

export type CursorTasksRemote = Pick<
  Context["remote"]["cursorTasks"],
  | "listModels"
  | "listTasks"
  | "create"
  | "resume"
  | "send"
  | "cancel"
  | "snapshot"
  | "watch"
>;
export interface TasksSnapshot {
  models: TaskModel[];
  tasks: TaskSummary[];
  selected?: TaskState;
  loading: boolean;
  action?: "create" | "resume" | "send" | "select" | undefined;
  error?: string | undefined;
}

/** 任务仅存在于独立 Cursor 域，切换页面只停止观察，不取消后台运行。 */
export class CursorTasksStore {
  private state: TasksSnapshot = { models: [], tasks: [], loading: false };
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | undefined;
  private generation = 0;
  private selection = 0;
  private mounted = 0;
  private disposed = false;
  constructor(private readonly remote: CursorTasksRemote) {}
  readonly getSnapshot = (): TasksSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: TasksSnapshot): void {
    if (this.disposed) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  private accept(task: TaskState): void {
    const previous = this.state.selected;
    if (previous?.id !== task.id || task.revision < previous.revision) return;
    this.publish({
      ...this.state,
      selected: task,
      tasks: this.state.tasks.map((item) =>
        item.id === task.id ? task : item,
      ),
    });
  }
  private observe(): void {
    this.controller?.abort();
    this.controller = undefined;
    const id = this.state.selected?.id;
    if (!id || !this.mounted || this.disposed) return;
    const controller = new AbortController();
    this.controller = controller;
    const generation = this.generation;
    const selection = this.selection;
    void (async () => {
      try {
        for await (const task of this.remote.watch(id, controller.signal)) {
          if (
            controller.signal.aborted ||
            generation !== this.generation ||
            selection !== this.selection
          )
            return;
          this.accept(task);
        }
        if (!controller.signal.aborted)
          this.publish({
            ...this.state,
            error: "任务状态连接已断开，请刷新任务。",
          });
      } catch {
        if (!controller.signal.aborted)
          this.publish({
            ...this.state,
            error: "无法读取任务动态，请刷新任务。",
          });
      }
    })();
  }
  mount(): () => void {
    if (this.disposed) return () => {};
    if (++this.mounted === 1) {
      this.observe();
      void this.refresh();
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (--this.mounted === 0) {
        this.controller?.abort();
        this.controller = undefined;
      }
    };
  }
  readonly refresh = async (): Promise<void> => {
    if (this.disposed || this.state.loading) return;
    const generation = this.generation;
    this.publish({ ...this.state, loading: true, error: undefined });
    // 两路独立发布：远端模型目录即使一直等待，本机历史也应立即可读。
    const models = (async () => {
      try {
        const result = await this.remote.listModels();
        if (generation !== this.generation) return;
        this.publish({
          ...this.state,
          models: result.ok ? result.value : [],
          ...(result.ok ? {} : { error: result.error.message }),
        });
      } catch {
        if (generation === this.generation)
          this.publish({
            ...this.state,
            models: [],
            error: "暂时无法读取模型，可继续查看本机任务记录。",
          });
      }
    })();
    const tasks = (async () => {
      try {
        const result = await this.remote.listTasks();
        if (generation !== this.generation) return;
        if (!result.ok) {
          this.publish({ ...this.state, error: result.error.message });
          return;
        }
        this.publish({ ...this.state, tasks: result.value });
        if (this.state.selected) {
          const selected = this.unwrap(
            await this.remote.snapshot(this.state.selected.id),
          );
          if (generation === this.generation) this.accept(selected);
        }
        if (generation === this.generation) this.observe();
      } catch {
        if (generation === this.generation)
          this.publish({
            ...this.state,
            error: "暂时无法读取任务列表，请刷新重试。",
          });
      }
    })();
    await Promise.allSettled([models, tasks]);
    if (generation === this.generation)
      this.publish({ ...this.state, loading: false });
  };
  private unwrap<T>(result: RemoteResult<T>): T {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : "无法连接 Cursor 任务服务，请重试。";
  }
  private async run(
    action: NonNullable<TasksSnapshot["action"]>,
    operation: () => Promise<RemoteResult<TaskState>>,
    select = false,
  ): Promise<void> {
    if (this.disposed || this.state.action) return;
    const generation = this.generation;
    const selection = select ? ++this.selection : this.selection;
    if (select) {
      this.controller?.abort();
      this.controller = undefined;
    }
    this.publish({ ...this.state, action, error: undefined });
    try {
      const task = this.unwrap(await operation());
      if (generation !== this.generation || selection !== this.selection)
        return;
      if (select) {
        this.publish({
          ...this.state,
          selected: task,
          tasks: [
            task,
            ...this.state.tasks.filter((item) => item.id !== task.id),
          ],
        });
        this.observe();
      } else this.accept(task);
    } catch (error) {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, error: this.message(error) });
      if (
        select &&
        generation === this.generation &&
        selection === this.selection
      )
        this.observe();
    } finally {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, action: undefined });
    }
  }
  readonly create = (input: CreateTaskInput): Promise<void> =>
    this.run("create", () => this.remote.create(input), true);
  readonly select = (id: string): Promise<void> =>
    this.run("select", () => this.remote.snapshot(id), true);
  readonly resume = (id: string): Promise<void> =>
    this.run("resume", () => this.remote.resume(id), true);
  readonly send = (id: string, text: string): Promise<void> =>
    this.run("send", () => this.remote.send(id, text));
  readonly cancel = async (id: string, attemptId: string): Promise<void> => {
    const generation = this.generation;
    const selection = this.selection;
    try {
      const task = this.unwrap(await this.remote.cancel(id, attemptId));
      if (generation === this.generation && selection === this.selection)
        this.accept(task);
    } catch (error) {
      if (generation === this.generation && selection === this.selection)
        this.publish({ ...this.state, error: this.message(error) });
    }
  };
  readonly reset = (): void => {
    this.generation++;
    this.selection++;
    this.controller?.abort();
    this.controller = undefined;
    this.publish({ models: [], tasks: [], loading: false });
    if (this.mounted) void this.refresh();
  };
  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.listeners.clear();
  }
}

/** 浏览器端先做输入提示；Host 仍独立校验路径并控制权限。 */
export function isAbsoluteWorkspace(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+|\/)/.test(value.trim());
}
