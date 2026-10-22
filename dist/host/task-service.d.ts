import type { Context } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type { CreateTaskInput, StandaloneRuntime, TaskModel, TaskState, TaskSummary } from "../shared/tasks.js";
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
/** Gateway 出站不保证 strip，因此此处逐字段构造真正送往客户端的值。 */
export declare function projectTaskState(value: TaskState): TaskState;
/** 独立 Cursor 任务域，不注册或覆盖宿主的全局模型、Agent 或会话。 */
export declare class CursorTaskService extends TypertRemoteService {
    private readonly runtime;
    private pending;
    private watchers;
    private readonly sending;
    constructor(ctx: Context, runtime: StandaloneRuntime);
    private call;
    private id;
    listModels(): Promise<TaskModel[]>;
    listTasks(): Promise<TaskSummary[]>;
    create(input: CreateTaskInput): Promise<TaskState>;
    resume(id: string): Promise<TaskState>;
    send(id: string, text: string): Promise<TaskState>;
    cancel(id: string, attemptId: string): Promise<TaskState>;
    snapshot(id: string): Promise<TaskState>;
    watch(id: string, signal: AbortSignal): AsyncIterable<TaskState>;
}
//# sourceMappingURL=task-service.d.ts.map