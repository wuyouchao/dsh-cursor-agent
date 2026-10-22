# DeepSeek Harness 插件开发研究

研究日期：2026-10-22。官方源码基线：[`687f282e8625c6b8d11ff58211a90524be2e4317`](https://github.com/deepseek-ai/deepseek-harness/commit/687f282e8625c6b8d11ff58211a90524be2e4317)，对应 `0.2.1-rc.2`。结论来自官方源码、文档及 npm 元数据；完整 Web 宿主尚未实机验证。

## 1. 插件入口和依赖

宿主插件导出 `name`、`apply(ctx, config)`，需要时导出 `inject` 和 `Config`。也可使用 `Service` 子类。`inject` 指明实际消费的服务，不靠 YAML 行顺序解决依赖。当前初始化入口只用 Cordis 内置 logger，因此无需 `inject`。

```ts
import type { Context } from "@deepseek-ai/cordis";

export const name = "dsh-cursor-agent";
export function apply(ctx: Context): void {
  ctx.logger.info("插件已加载");
}
```

`Config` 接受 Standard Schema，官方常用 `@deepseek-ai/schemastery`。后续需要动态配置时使用其 `.volatile()`/`.get()` 机制，而不是在初始化时永久缓存配置值。

来源：[首个插件](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop/basic/index.md)、[配置](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop/basic/config.md)。

## 2. 生命周期和打包

`ctx.on`、`ctx.plugin`、服务注册随 Context 作用域清理。SDK 实例、登录等待和子进程需要通过 `ctx.effect` 注册清理；多个异步清理器可能并行执行，有顺序要求的“取消 → 等待 → 关闭”应放入同一个清理函数。

安装包用 `dsh.bundle.patch` 指向补丁 YAML，导出已编译的宿主入口。本项目的补丁只插入插件行。后续完整 Agent 模式需要独立补丁停用默认 loop，不应现在就停用可工作的宿主功能。

```yaml
- insert:
    - id: dsh-cursor-agent
      name: dsh-cursor-agent
```

本地预编译 tgz 可用 `dsh plugin --profile web add ./dsh-cursor-agent-0.0.2.tgz` 安装到已有 Web profile。新 profile 的默认 base 与 Web 应用不同。仅提供 TypeScript 源码的 Git 安装需要构建脚本及相应许可；本项目从 `0.0.2` 起把预编译入口随 Git 提交，移除 `prepare`，避免安装阶段触发构建许可。Desktop 应使用自己的 `desktop` profile。

来源：[生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop/framework/index.md)、[打包发布](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop/basic/publish.md)。

## 3. 完整 Agent 的接入点

官方提供 `ctx.agents.setFactory(factory)`。同一个 `ctx.agents` 服务实例只允许一个 factory；完整 Cursor 模式应停用默认 `agent-loop`，子 Context 不会自动产生独立注册表。

```ts
interface AgentFactory {
  createAgent(
    ownerCtx: Context,
    options: CreateAgentOptions,
  ): Promise<AgentHandle>;
  resume(ownerCtx: Context, options: ResumeAgentOptions): Promise<AgentHandle>;
}
interface AgentHandle {
  agent: Agent;
  dispose(): Promise<void>;
}
```

适配后的 Agent 需要实现 `options/session/inbox/status/ctx`，以及 `send`、`followup`、`steer`、`inject`、`cancel`、`whenIdle`、`runMaintenance`。这不是给 `Agent.send()` 换一个函数名就能完成的桥接。`followup/steer` 接受带标识的用户消息，`whenIdle` 等待整个 Agent 空闲。

`ownerCtx` 决定资源归属。创建顺序须包含 Session prepare、构造 Agent 作用域、执行 `setup(agentCtx, agent)` 及 commit、进入 Session/Agent 注册表、announce，成功后才启动工作。失败必须回滚；释放必须取消运行、关闭持久化和移除注册。

来源：[Agent 接口](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent/src/runtime-types.ts)、[服务注册](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent/src/index.ts)、[官方默认 factory](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/index.ts)。

## 4. 消息、流与恢复

实时展示走 `agent/assistant-stream` 的 `start/chunk/end`，以 `attemptId`、`revision` 等字段关联。最终 `assistant/message` 或 `assistant/attempt` 必须先持久化，再结束 committed stream；仅推送 chunk 不能保证重载后的回放。

当前 Session 格式为 V4。`appendPluginRecord` 是可忽略、迁移时尽力保留的实验记录，不适合作为唯一恢复依据。建议单独持久化版本化映射：DSH session ID、Cursor agent ID、工作区身份、SDK store 路径与必要配置。

来源：[AssistantStreamAttempt](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/agent-loop/src/assistant-stream.ts)、[Session](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/session/src/index.ts)。

## 5. 界面和远程服务

自有插件设置页使用 `plugins.bundle.config` 或 `plugins.row.config` 扩展点。浏览器入口 `./client` 需要 lazy-CJS factory 协议，普通 ESM React 产物不可直接替代；官方构建 preset 位于仓库内部，外部插件需配置兼容构建。

远程服务采用 `TypertRemoteService`、`@Remote` 和生成的 `./typert`、`./remote` 产物。客户端调用 `ctx.remote.<namespace>`，按 `RemoteResult.ok` 处理结果。后续登录 UI 应发送登录开始/取消请求、展示授权 URL、订阅状态；认证密钥只留在宿主。

这部分先写入方案，不在初始化时伪造旧式 HTTP 路由。

来源：[设置卡片](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/cookbook/adding-a-settings-card.md)、[客户端模块协议](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/modules/README.md)、[远程 API](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/cookbook/adding-a-remote-api.md)。

## 6. 版本结论

`@deepseek-ai/dsh-agent@0.2.1-rc.2` 确实存在，但研究时它的 `latest` 标签仍指向 `0.1.0-rc.6`。当前 CLI 为 `0.2.1-rc.2`，Cordis peer 为 `~4.0.5`。实现时必须精确选择同批 Harness 包，不能混用各包的 latest。

初始化只安装实际使用的 Cordis 和 Cursor SDK；等实现 factory、Session、Typert 或浏览器扩展时，再加入对应的同版 Harness 包。
