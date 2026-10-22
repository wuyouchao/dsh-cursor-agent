# dsh-cursor-agent

为 DeepSeek Harness 的普通工作区与会话接入 Cursor 官方 SDK 账号及模型。

`0.3.0` 已实现真正的 LlmAdapter：在普通会话的模型菜单选择 Cursor，继续使用官方 AgentLoop、工作区、会话历史、工具和审批。Cursor SDK 只负责推理与提出工具请求，实际工具由 Harness 执行。独立“Cursor 任务”侧栏与页面撤下。

## 当前状态与限制

本版本已通过 `npm run check` 的 Typert 契约生成、严格类型、格式、生产构建及 107 项离线测试（107 通过、0 失败）。0.2→0.3 隔离升级与真实 Host 模型路由激活已通过，具体证据见 [实施计划](docs/implementation-plan.md) 和 [验证记录](docs/verification.md)。

- 账号入口保留在“设置 → Cursor”及模型设置页；凭据由官方公开 SDK 管理。
- 每个 Harness step 新建 SDK Agent，完整 Harness transcript 为权威，工具结果随下一步历史传入，不依赖 SDK checkpoint 恢复普通会话。
- SDK customTools callback 仅排队请求。确认 SDK run 停止后，才交给 Harness 的工具与审批流程执行，避免双重执行或并行副作用。
- SDK 使用 `tools: ["mcp"]`、`settingSources: []`、`mcpServers: {}`，禁止 SDK 原生工作区工具和外部 MCP 绕过 Host。
- 权限由 Harness 控制；插件配置默认为空对象，旧版本的权限与状态目录字段兼容但忽略。

本版面向文本输入。SDK `systemPrompt` 受账号 allowlist 限制，因此使用带角色标签的完整 transcript 作为单条 user payload；这不等价于原生 system/developer 消息语义。每一步重新发送历史会增加上下文体积，完整 transcript 上限为 2 MiB，超限明确报错，不静默截断；附件与图片明确拒绝，跨模型切换保留文本历史。

**真实浏览器授权、真实账号模型请求、付费对话及 Desktop 完整流程尚未实测。** 本机凭据已保存、远端 me/models 验证成功与真实对话是不同事实；界面“连接成功”要求远端账号和目录验证成功。

## 安装与升级

兼容目标：Node.js 24、Harness `0.2.1-rc.2`、Cordis `4.0.5`、Cursor SDK `1.0.40`。插件随包安装 SDK，无需单独安装 Cursor 桌面应用或全局 SDK；SDK 托管组件仍依赖平台及登录条件，真实环境兼容性待验收。

安装发行版本时，完全退出 Desktop，使用以下命令安装或原地升级；无需先卸载或重新配置官方账号：

```sh
dsh plugin --profile desktop add github:wuyouchao/dsh-cursor-agent#v0.3.0
```

Desktop“添加插件”窗口可填写同一 Git 地址。Web 用户将 `desktop` 替换为已有的 `web` profile，完成后重启对应实例。Git 安装使用提交的 `dist/` 与 `lib/`，不运行安装生命周期构建。

`0.2.0` 的独立 Cursor 任务磁盘数据保留，但不自动迁移到普通会话；新版不再提供该任务入口。普通会话由 Host 的历史与持久化机制管理。

## 使用方式

1. 打开“设置 → Cursor”，通过官方 SDK 登录并刷新连接状态。
2. 打开普通工作区与会话，在模型菜单中选择 Cursor 模型。
3. 发送文本需求，通过原有会话查看回复、工具执行及审批状态。

发送请求可能产生 Cursor 用量费用。动态模型及变体来自 Cursor 目录，推理强度通过目录 variant 选择。`GenerateOptions` 的 `maxTokens`、`temperature`、`stop`、`reasoningEffort` 明确拒绝；普通模型菜单切换会清除旧模型的推理强度选项。

**标题与压缩限制：** 默认辅助任务沿用最近普通请求的模型。标题请求传入 `maxTokens: 4096`，Cursor 拒绝后回退为首条消息标题，不阻断聊天。压缩请求固定传入 `maxTokens`，Cursor 同样拒绝：自动压缩记录警告并继续，但无法靠该压缩恢复超限上下文；手动压缩失败。

用户可为官方标题插件 `@deepseek-ai/dsh-session-title-first-prompt-llm`（patch 行 ID `session-title-llm`）配置 `config.provider`、`config.model`；为 `@deepseek-ai/dsh-compaction-basic` 配置 `config.summarizationProvider`、`config.summarizationModel`，填写账号已有且支持这些参数的非 Cursor 模型。插件不会自动修改 profile，也不会静默转向其他付费模型。

账号 CLI 保留；Desktop 用户先退出 Desktop，Web 用户替换 profile 名称：

```sh
dsh plugin --profile desktop exec dsh-cursor-agent-auth login
dsh plugin --profile desktop exec dsh-cursor-agent-auth status
dsh plugin --profile desktop exec dsh-cursor-agent-auth logout
```

CLI `status` 只查询 SDK 本机保存状态，不验证远端密钥。`CURSOR_API_KEY` 优先于保存的登录；退出只清除 SDK 保存凭据，不撤销远端 Key、不修改环境变量。插件不读取私有凭据文件结构，不把 Key 写入日志、会话或客户端响应。

## 开发与打包

```sh
npm ci
npm run check
npm pack
```

提交前运行 `npm run check`，新增运行逻辑优先使用离线 SDK 替身，不执行付费模型测试。生产依赖仅为 SDK/zod；Host 包精确锁定为 peer 与开发依赖，由 Harness 共享解析。修改源码后构建并同步提交 `dist/` 与生成的 `lib/`；不要添加 `prepare` 等安装生命周期脚本。

项目未发布 npm 包，`private: true` 防止误发布。隔离环境可使用 `dsh plugin --profile web add ./dsh-cursor-agent-0.3.0.tgz` 验收；该命令会修改指定 profile，应在用户选择的验证环境执行。

## 设计与证据

- [Harness 接口研究](docs/research/deepseek-harness.md)
- [Cursor SDK 研究](docs/research/cursor-sdk.md)
- [架构](docs/architecture.md)
- [实施与验证计划](docs/implementation-plan.md)
- [验证步骤与记录](docs/verification.md)

## 许可证

本项目采用 [MIT](LICENSE)。Cursor SDK 使用其自身许可与服务条款。本项目为独立社区项目，与 Cursor、DeepSeek 官方无隶属关系。
