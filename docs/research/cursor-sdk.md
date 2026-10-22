# Cursor SDK 接入研究

研究日期：2026-10-22。基线：npm `@cursor/sdk@1.0.40` 的实际类型声明及[官方 TypeScript 文档](https://cursor.com/docs/sdk/typescript)。本次未进行真实登录或付费模型调用。

## 1. 运行方式

SDK 是完整 Agent 运行时。本地模式在 Node.js 中运行 Agent 循环和工作区工具，模型推理仍在 Cursor 服务端。本项目选择本地模式；云端 VM 不属于第一版范围。

包要求 Node.js `>=22.13`，本项目选择 Node.js 24。发布包提供 Windows x64 平台构件，包括 sandbox helper、ripgrep 和原生解析模块。这证明平台文件存在，不等于本机沙箱已经可用；完整文件修改、Shell 和沙箱仍需端到端验收。

来源：[运行与安装](https://cursor.com/docs/sdk/typescript#overview)、[npm 发布包](https://www.npmjs.com/package/@cursor/sdk/v/1.0.40)。

## 2. 官方认证

```ts
Cursor.auth.login(options?: SdkLoginOptions): Promise<SdkLoginResult>;
Cursor.auth.status(options?: SdkAuthStatusOptions): Promise<SdkAuthStatus>;
Cursor.auth.logout(options?: SdkLogoutOptions): Promise<void>;
```

`login` 的关键参数为 `openBrowser`、`onLoginUrl`、`signal`、`store`、`apiKeyName`、`apiKeyTtlMs`。宿主可用 `openBrowser: false` 配合 `onLoginUrl` 向浏览器 UI 提供官方授权链接，使用 AbortSignal 取消等待。

登录结果含 `apiKey`、可选 `email` 和 `apiKeyExpiresAtMs`；对外响应必须显式拣选安全字段，不能展开或记录整个结果对象。本项目认证包装已经落实这一点。

默认登录生成有期限的用户 Key，存入 `~/.cursor/sdk/auth.json`；不读取桌面 Cursor 的登录缓存。SDK 优先采用显式 `apiKey`，其次环境变量 `CURSOR_API_KEY`，最后保存的登录。不要自己解析 SDK 私有文件结构。

`status` 仅描述保存的本地登录，结果为 `logged-out` 或带 backend/email/过期时间的 `logged-in`。它不检查环境变量，也不联系服务端验证 Key。`logout` 仅清本地存储，远端撤销需要由用户管理。

初始化使用 SDK 默认凭据存储。若将来为 Harness 多用户服务提供独立存储，不能只给 login 传自定义 store：创建 Agent 时还需显式使用该存储中的 Key。

来源：[官方认证接口](https://cursor.com/docs/sdk/typescript#cursor-auth)、发布包 `auth/login.d.ts` 与 `auth/credential-store.d.ts`。

## 3. Agent、Run 与释放

```ts
Agent.create(options: AgentOptions): Promise<SDKAgent>;
Agent.resume(agentId: string, options?: Partial<AgentOptions>): Promise<SDKAgent>;

agent.send(message: string | SDKUserMessage, options?: SendOptions): Promise<Run>;
run.stream(): AsyncGenerator<SDKMessage, void>;
run.wait(): Promise<RunResult>;
run.cancel(): Promise<void>;

agent.close(): void;
agent[Symbol.asyncDispose](): Promise<void>;
```

创建时传 `local: { cwd }`；`agent.agentId` 是恢复标识。`run.wait()` 的最终文本为 `result.result`，状态为 `finished/error/cancelled`。异步释放需要等待 `Symbol.asyncDispose`，不能把同步 `close()` 当作所有资源已释放。

适配层需分别管理“一个持久会话 Agent”和“每轮 Run”。取消一轮不应删会话；卸载插件需要先取消活动运行，再等待退出并释放。

来源：[创建和恢复](https://cursor.com/docs/sdk/typescript#creating-agents)、发布包 `agent.d.ts`、`options.d.ts`、`run.d.ts`。

## 4. 流式事件与模型

逐 token 增量来自 `agent.send(message, { onDelta })`，其中包括 `text-delta`。`run.stream()` 提供规范化 assistant、tool_call、usage、request 等消息。应明确各通道职责，避免同时累加 delta 与完整消息导致重复文本。

工具事件可依赖的外层字段为 `call_id/name/status`；`args/result` 按 `unknown` 防御式处理。工具名和内部载荷可能变化。工具结果仅映射为 Harness 展示记录，不能交给 Harness 执行器再次执行。

模型目录使用 `Cursor.models.list({ apiKey?, teamId? })`，响应包含模型 ID、名称、参数与变体。选择传给 Agent 的原始模型 ID 和参数；UI 合成的 route ID 不应直接传给 SDK。初始化尚未调用模型目录接口。

来源：[流式接口](https://cursor.com/docs/sdk/typescript#streaming)、发布包 `messages.d.ts` 和模型类型声明。

## 5. 持久化

保存 Cursor agent ID 并在恢复时调用 `Agent.resume`。SDK 支持显式 `JsonlLocalAgentStore`，可作为首版可检查的存储实现；创建、恢复及列表操作必须使用同一路径和 store。

恢复时须重新提供非持久化配置，如模型、工具约束及 MCP 配置。映射文件丢失、workspace 不匹配或 SDK checkpoint 缺失时应报告恢复失败，不能静默创建空对话并冒充续聊。活动工具回调是否跨进程恢复需要单独验证，不能从普通会话恢复能力推导。

来源：[SDK 存储说明](https://cursor.com/docs/sdk/typescript)、发布包 `store/jsonl-local-agent-store.d.ts`。

## 6. 审批和权限边界

本地 SDK 默认可自动执行工具。`sandboxOptions`、工具 allow/deny 和 `autoReview` 的语义不同，不能统一映射成“支持 Harness 审批”。`autoReview` 还可能因后端不支持而回退，不能单独承担强制安全策略。

当前公开 SDK 没有程序化 `canUseTool`/hook 回调。Hooks 采用 `.cursor/hooks.json`。文档称 `request` 事件可表示用户输入/审批等待，但类型只提供请求标识，公开 Agent/Run 接口没有完整响应方法。因此本版本不能承诺 Harness 原生人工审批闭环。

后续第一轮端到端验证应从受限只读工具开始，验证权限可执行后再加入写文件和 Shell。收到不支持的交互请求必须明确结束并报告，不能静默同意。初始化尚不创建或执行 Agent。

来源：[Sandbox](https://cursor.com/docs/sdk/typescript#sandbox-options)、[Hooks](https://cursor.com/docs/hooks#pretooluse)。
