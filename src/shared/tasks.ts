/** Cursor 独立运行域的安全传输类型，不包含 SDK 实例、凭据或原始异常。 */
export interface TaskModel {
  id: string;
  name: string;
}
export interface TaskMessage {
  id: string;
  role: "user" | "assistant" | "thinking" | "tool";
  text: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
}
export interface TaskSummary {
  id: string;
  cwd: string;
  revision: number;
  model: string;
  status: "idle" | "running" | "stored" | "unavailable";
  permissionMode: "readonly" | "workspace-write" | "shell";
  sandboxEnabled: boolean;
  attemptId?: string;
}
export interface TaskState extends TaskSummary {
  messages: TaskMessage[];
}
export interface CreateTaskInput {
  cwd: string;
  model: string;
}
/** 后端所属的独立运行时；创建任务不会发送提示词。 */
export interface StandaloneRuntime {
  listModels(): Promise<TaskModel[]>;
  listTasks(): Promise<TaskSummary[]>;
  create(input: CreateTaskInput): Promise<TaskState>;
  resume(id: string): Promise<TaskState>;
  send(id: string, text: string): Promise<TaskState>;
  cancel(id: string, attemptId?: string): Promise<TaskState>;
  snapshot(id: string): Promise<TaskState>;
  watch(id: string, signal: AbortSignal): AsyncIterable<TaskState>;
  dispose(): Promise<void>;
}
