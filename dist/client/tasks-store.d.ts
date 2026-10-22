import type { Context } from "@deepseek-ai/cordis";
import type { CreateTaskInput, TaskModel, TaskState, TaskSummary } from "../shared/tasks.js";
export type CursorTasksRemote = Pick<Context["remote"]["cursorTasks"], "listModels" | "listTasks" | "create" | "resume" | "send" | "cancel" | "snapshot" | "watch">;
export interface TasksSnapshot {
    models: TaskModel[];
    tasks: TaskSummary[];
    selected?: TaskState;
    loading: boolean;
    action?: "create" | "resume" | "send" | "select" | undefined;
    error?: string | undefined;
}
/** 任务仅存在于独立 Cursor 域，切换页面只停止观察，不取消后台运行。 */
export declare class CursorTasksStore {
    private readonly remote;
    private state;
    private readonly listeners;
    private controller;
    private generation;
    private selection;
    private mounted;
    private disposed;
    constructor(remote: CursorTasksRemote);
    readonly getSnapshot: () => TasksSnapshot;
    readonly subscribe: (listener: () => void) => (() => void);
    private publish;
    private accept;
    private observe;
    mount(): () => void;
    readonly refresh: () => Promise<void>;
    private unwrap;
    private message;
    private run;
    readonly create: (input: CreateTaskInput) => Promise<void>;
    readonly select: (id: string) => Promise<void>;
    readonly resume: (id: string) => Promise<void>;
    readonly send: (id: string, text: string) => Promise<void>;
    readonly cancel: (id: string, attemptId: string) => Promise<void>;
    readonly reset: () => void;
    dispose(): void;
}
/** 浏览器端先做输入提示；Host 仍独立校验路径并控制权限。 */
export declare function isAbsoluteWorkspace(value: string): boolean;
//# sourceMappingURL=tasks-store.d.ts.map