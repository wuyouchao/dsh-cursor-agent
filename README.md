# dsh-cursor-agent

为 DeepSeek Harness 接入 Cursor 官方 SDK 的账号管理与独立原生 Agent 任务。

`0.2.0` 将 Cursor 任务放入独立运行域，通过侧栏“Cursor 任务”使用；官方聊天、模型提供方与默认 Agent 循环继续由 Harness 管理。Cursor 执行原生 Agent 循环及实际工具，Harness 展示文本与工具记录，不重复执行工具。

## 能力与验证范围

- “设置 → Cursor”提供登录链接、复制、取消、状态刷新和退出；模型设置页也保留账号入口。
- “连接成功”要求远端账号信息与模型目录验证成功。本机已保存凭据、远端连接和真实 Agent 对话是不同事实。
- “Cursor 任务”支持填写工作区绝对路径、选择动态模型、创建任务、发送文本、多轮流式展示、查看工具记录、取消及恢复本机任务。
- 创建任务不发送提示词；点击“发送”后才开始模型执行，可能产生 Cursor 用量费用。关闭页面不会取消活动任务。
- 默认只读并启用 SDK 沙箱；可通过插件配置显式选择工作区写入或 Shell。Windows 沙箱实际执行仍需真实环境验收。

`0.2.0` 已通过完整构建、87 项离线测试、真实菜单插槽挂载及从 `0.1.1` 原地升级后的 Host 解析器激活验证，详见 [验证记录](docs/verification.md)。**尚未执行真实浏览器授权、真实账号模型请求、计费对话或 Desktop 实机安装验收。**

## 安装与升级

兼容目标：Node.js 24、Harness `0.2.1-rc.2`、Cordis `4.0.5`、Cursor SDK `1.0.40`。插件随包安装 SDK，无需单独安装 Cursor 桌面应用或全局 SDK；SDK 托管运行组件仍受平台与登录条件约束，真实环境兼容性尚待验收。

完全退出 Desktop 后，使用以下命令安装或原地升级；无需先卸载，也无需重新配置 Harness 官方账号：

```sh
dsh plugin --profile desktop add github:wuyouchao/dsh-cursor-agent#v0.2.0
```

该命令要求 `v0.2.0` 标签已发布。Desktop 的“添加插件”窗口可填写同一个 Git 地址。Web 用户将 `desktop` 替换为已有的 `web` profile。安装后重启对应实例。

`0.1.1` 使用专用 Cursor 模式，会接管全局 Agent factory 并停用官方循环及模型提供方。`0.2.0` 的 bundle patch 仅插入本插件，不改写官方 loop、providers 或默认模型；Host 包改用精确版本 peer 依赖与开发依赖，由 Harness 共享解析，避免插件生产依赖复制宿主作用域包造成冲突。旧版任务数据能否恢复仍须满足原生 Agent、工作区、权限与 checkpoint 校验，不承诺自动迁移。

Git 安装直接使用仓库内的 `dist/` 与 `lib/` 预编译产物，不执行安装生命周期构建。项目未发布 npm 包，`private: true` 防止误发布。

## 使用与限制

1. 打开“设置 → Cursor”，完成授权并刷新连接状态。
2. 打开侧栏“Cursor 任务”，填写可访问的工作区绝对路径，选择模型并创建任务。
3. 输入需求并点击“发送”，查看文本流及工具记录；运行中可取消。
4. 重启后从任务记录选择具有有效 checkpoint 的任务，点击“恢复任务”后继续对话。

Cursor 任务不注册到宿主全局 Agent 或 LLM，不出现在官方模型选择器中。目录提供的模型及变体直接用于 Cursor 运行；独立 `maxTokens`、`reasoningEffort` 不映射为假支持。

目前仅支持文本输入。图片、分叉、Harness 子 Agent、steer/inject、人工审批响应和 Harness maintenance/压缩尚不支持；原生工具要求人工交互时运行会终止。取消等待原生运行确认终态；收尾超时后停止复用该 Agent，避免重叠运行。恢复失败不会创建空 Agent 冒充成功。SDK `1.0.40` 通常在首次发送后才产生 checkpoint；新建但未发送的空任务重启后无法恢复，会标记为不可用并提示新建。已有任务的 checkpoint 丢失或上次运行未结束时也拒绝恢复。取消等待五秒仍未确认停止、或持久化失败的任务会标记为不可用，不能继续或盲目重建同一任务。

任务映射、独立 JSONL 会话与 SDK checkpoint 使用插件状态目录保存。默认位于对应 profile 的 `cursor-agent/tasks/`，按 profile 隔离；无 profile 时使用 `~/.dsh/cursor-agent/<工作目录摘要>/`，可通过 `stateDirectory` 指定位置。映射不含账号凭据。

账号 CLI 仍可使用，Desktop 用户先退出 Desktop，Web 用户替换 profile 名称：

```sh
dsh plugin --profile desktop exec dsh-cursor-agent-auth login
dsh plugin --profile desktop exec dsh-cursor-agent-auth status
dsh plugin --profile desktop exec dsh-cursor-agent-auth logout
```

CLI `status` 仅查询 SDK 本机保存状态，不验证远端密钥。`CURSOR_API_KEY` 优先于保存的登录；退出只清除 SDK 保存凭据，不撤销远端 Key、不修改环境变量。认证只使用官方公开 SDK，插件不读取私有凭据文件结构，不把 Key 写入日志、会话或客户端响应。

## 开发和打包

```sh
npm ci
npm run check
npm pack
```

`check` 包含 Typert 契约生成、严格类型、格式、生产构建与离线测试。默认测试不登录、不调用付费模型。生产依赖仅含 `@cursor/sdk` 与 `zod`；Host 依赖精确锁定并由 Harness 共享。修改源码后同步构建并提交 `dist/` 与生成的 `lib/`；不要添加 `prepare` 等安装生命周期脚本。

隔离环境的本地包验收命令：

```sh
dsh plugin --profile web add ./dsh-cursor-agent-0.2.0.tgz
```

该命令会修改指定 profile，应在用户选择的验证环境执行。

## 设计与证据

- [Harness 接口研究](docs/research/deepseek-harness.md)
- [Cursor SDK 研究](docs/research/cursor-sdk.md)
- [架构](docs/architecture.md)
- [实施计划](docs/implementation-plan.md)
- [验证步骤与记录](docs/verification.md)

## 许可证

本项目采用 [MIT](LICENSE)。Cursor SDK 使用其自身许可与服务条款。本项目为独立社区项目，与 Cursor、DeepSeek 官方无隶属关系。
