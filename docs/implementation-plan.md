# 0.3.0 实施与验证计划

本版本撤回独立 Cursor 任务界面，将 Cursor 接入普通工作区和会话的模型菜单。Cursor 作为真正的 LlmAdapter 提供推理与工具请求，官方 AgentLoop 管理工作区、历史、工具、审批与执行。上述改造已实现，本版全量检查与 107 项离线测试通过，0.2→0.3 隔离升级与真实 Host 模型路由激活已通过。

## 执行顺序

1. 核对公开 LlmAdapter、模型目录、流式事件与 customTools 契约，保留官方 AgentLoop、providers、默认模型与预设。
2. 实现 Cursor adapter：每个 Harness step 新建 SDK Agent，完整 Harness transcript 为权威；把带角色标签的历史封装为单条 user payload。
3. SDK callback 只记录、排队工具请求，不执行 Host 工具。确认 SDK run 已停止后才向 Harness 产出 tool-call；由官方工具与审批流程执行，下一步携结果重建 SDK Agent。
4. 限定 SDK 工具入口为 `tools: ["mcp"]`，使用 `settingSources: []`、`mcpServers: {}`，阻断原生工具与外部 MCP 绕过 Host 的路径。
5. 保留“设置 → Cursor”和模型页账号卡，撤下独立任务侧栏及页面；保留旧任务磁盘数据，不自动迁移。
6. 配置以空对象为默认，旧权限/状态目录等字段兼容但忽略；权限由 Host 控制。同步固定依赖、v0.3.0 版本及预编译产物。

## 离线验证结果

| 验证项       | 通过条件                                                                     | 当前状态                   |
| ------------ | ---------------------------------------------------------------------------- | -------------------------- |
| 普通会话集成 | 模型菜单可选 Cursor；官方 AgentLoop、工作区、历史、其他模型保持工作          | 已实现，离线验证通过       |
| transcript   | 每 step 使用完整 Host 历史；工具结果进入下一步；无 SDK checkpoint 权威依赖   | 已实现，离线验证通过       |
| 工具执行边界 | callback 无副作用；SDK run 停止前不向 Host 交付工具请求；Host 每次只执行一次 | 已实现，离线验证通过       |
| 旁路阻断     | SDK 仅启用 customTools 所需 MCP 入口，不加载设置来源及外部 MCP               | 已实现，离线验证通过       |
| 取消与错误   | 停止未确认时不执行排队工具；异常不会伪装成功或泄露秘密                       | 已实现，离线验证通过       |
| 账号与界面   | 两处账号入口保留；独立任务入口撤下；旧磁盘数据不删除、不迁移                 | 已实现，离线验证通过       |
| 配置与安装   | 空配置可用；旧字段忽略；Host 共享解析；Git 使用预编译产物                    | 配置、构建与隔离升级均通过 |

SDK `systemPrompt` 受账号 allowlist 限制，本版使用角色标签 transcript 的单 user payload；这不等价于原生 system/developer 消息语义。离线验证覆盖角色序列化、工具关联、上下文体积与不支持输入的明确错误。完整 transcript 上限为 2 MiB，超限明确错误、不截断；附件与图片拒绝，跨模型文本历史保留。`maxTokens`、`temperature`、`stop`、`reasoningEffort` 明确拒绝，推理强度使用目录 variant。需覆盖标题 `maxTokens: 4096` 失败后回退首条消息、不阻断聊天，以及默认自动/手动压缩固定 `maxTokens` 被拒绝的路径。自动压缩应警告后继续但无法恢复超限上下文，手动压缩失败。用户可为 `@deepseek-ai/dsh-session-title-first-prompt-llm`（patch 行 ID `session-title-llm`）设置 `config.provider/model`，为 `@deepseek-ai/dsh-compaction-basic` 设置 `config.summarizationProvider/summarizationModel`，显式选择可用非 Cursor 辅助模型。不得自动改 profile 或静默转向其他付费 provider，不能宣称默认 Cursor 完整支持压缩。未核实能力不得以成功占位。

## 验收边界

已核验 `npm run check` 完整日志：Typert 契约生成、严格类型、格式、生产构建及 107 项离线测试全部通过（107 通过、0 失败）。0.2→0.3 隔离升级与真实 Host 模型路由激活已通过，具体证据更新于 [verification.md](verification.md) 的具体命令与证据；已同步构建 `dist/` 与 `lib/`，随代码提交。不添加 `prepare` 等安装生命周期构建脚本。

自动验证使用离线 SDK 替身，不修改用户真实 profile，不执行浏览器授权或付费模型测试。真实账号、模型目录、付费运行、SDK 托管组件与 Desktop 完整流程均保留未实测状态，不能从旧版本或离线结果推断成功。
