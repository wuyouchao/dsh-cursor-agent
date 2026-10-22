# dsh-cursor-agent

为 DeepSeek Harness 接入 Cursor 官方 SDK 的账号管理、动态模型目录与原生 Agent。

`0.1.1` 提供专用 Cursor 模式：Cursor 执行 Agent 循环和实际工具，Harness 展示会话、流式文本与工具记录。工具事件只用于展示，不会在 Harness 再执行一次。

## 能力与验证范围

- 模型设置页提供 Cursor 登录链接、复制、取消、状态刷新和退出；凭据由官方 SDK 管理。
- “连接成功”表示远端账号信息与模型目录验证成功。本机已保存凭据、远端连接成功和真实 Agent 对话是不同状态。
- 注册独立 `cursor` 模型提供方，动态读取模型和变体，并把所选参数传给原生 Agent。
- 文本多轮、增量展示、取消与会话恢复已有实现和离线验证。恢复必须具有匹配的 Cursor Agent、工作区、权限配置和 checkpoint；已有非 Cursor 会话不能伪恢复。
- 默认工具策略为只读并启用 SDK 沙箱；可显式配置工作区写入或 Shell。SDK 的 Windows 沙箱实际执行仍需真实环境验收。

本轮使用真实 Harness 服务与离线 SDK 替身验证集成。**尚未执行真实浏览器授权、账号模型请求、计费对话或 Desktop 实机安装验收。** 详细证据及尚未验证项目见 [验证记录](docs/verification.md)。

## 安装到 Harness

兼容目标：Node.js 24、Harness `0.2.1-rc.2`、Cordis `4.0.5`、Cursor SDK `1.0.40`。无需安装 Cursor 桌面应用或手动安装 SDK。

本版本会将对应 profile 切换为专用 Cursor 模式，停用默认 Agent loop、DeepSeek/Pi 模型提供方及与原生循环冲突的自动标题、计划与压缩任务，保留账号配置数据和模型设置页。建议使用专门的验证 profile。恢复原模式应卸载插件并重启 Harness；仅关闭宿主插件开关不会移除 bundle patch。

Desktop 的“添加插件”窗口可填写：

```text
github:wuyouchao/dsh-cursor-agent#main
```

建议将 `#main` 替换为本次交付的固定提交 SHA，避免安装到后续变更。命令行管理 Desktop 插件前先完全退出 Desktop：

```sh
dsh plugin --profile desktop add github:wuyouchao/dsh-cursor-agent#main
```

Web 用户将 `desktop` 替换为已有的 `web` profile。安装后重新启动对应实例，在模型设置页的 Cursor 卡片完成授权、刷新目录，再在新会话选择 Cursor 模型。

Git 安装直接使用仓库中的 `dist/` 与 `lib/` 预编译产物，不执行 `prepare` 等安装构建脚本。若失败页面仍引用旧版本或 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，重新添加固定的新提交；旧任务的重试可能继续使用旧代码。

升级无需先卸载：完全退出 Desktop，使用上面的同一条 `dsh plugin --profile desktop add` 命令，将 Git 地址改为新版本的固定 SHA，完成后重启 Desktop。第三方插件在 GUI 中暂不提供更新操作，可使用此命令原地升级。

`0.1.1` 修复了 `0.1.0` 在 Desktop 启用时因未提供插件配置而出现的 `invalid config: expected object, received undefined`。配置省略时会应用只读权限与启用沙箱的默认值；遇到该错误请升级到包含此修复的固定提交并重启 Harness。

## 使用与限制

先在模型设置页连接 Cursor，选择目录中的模型，再新建会话。默认模型路由 `default` 由最新 Cursor 目录解析；独立 `maxTokens`、`reasoningEffort` 参数不映射为假支持，应使用目录提供的模型变体。

目前仅支持文本输入。图片、分叉、Harness 子 Agent、steer/inject、人工审批响应和 Harness maintenance/压缩尚不支持，会明确拒绝。原生工具产生人工交互请求时运行会终止。取消会等待原生运行确认终态；超过本地收尾时限则该 Agent 停止接收新消息，避免与尚未结束的运行重叠。

会话映射默认保存在对应 profile 目录的 `cursor-agent/` 下；独立组合无 profile 时使用 `~/.dsh/cursor-agent/<工作目录摘要>/`。映射不含账号凭据。可通过插件 `stateDirectory` 指定位置。

账号 CLI 仍可使用，Desktop 用户应先退出 Desktop，Web 用户替换 profile 名称：

```sh
dsh plugin --profile desktop exec dsh-cursor-agent-auth login
dsh plugin --profile desktop exec dsh-cursor-agent-auth status
dsh plugin --profile desktop exec dsh-cursor-agent-auth logout
```

CLI `status` 仅查询 SDK 本机保存状态，不验证远端密钥。`CURSOR_API_KEY` 优先于保存的登录；退出只清除 SDK 保存的凭据，不撤销远端 Key、不修改环境变量。插件不读取私有凭据文件结构，不把 Key 写入日志、会话或客户端响应。

## 开发和打包

```sh
npm ci
npm run check
npm pack
```

`check` 包含 Typert 契约生成、严格类型、格式、离线测试与生产构建。默认测试不登录、不调用付费模型。修改源码后必须同步构建并提交 `dist/` 与生成的 `lib/`；不要添加安装生命周期构建脚本。

本地包可在专用 profile 中验收：

```sh
dsh plugin --profile web add ./dsh-cursor-agent-0.1.1.tgz
```

此命令会修改指定 profile，应由用户自行在验证环境执行。项目未发布 npm 包，`private: true` 防止误发布。

## 设计与证据

- [Harness 接口研究](docs/research/deepseek-harness.md)
- [Cursor SDK 研究](docs/research/cursor-sdk.md)
- [架构](docs/architecture.md)
- [实施计划](docs/implementation-plan.md)
- [验证步骤与记录](docs/verification.md)

## 许可证

本项目采用 [MIT](LICENSE)。Cursor SDK 使用其自身许可与服务条款。本项目为独立社区项目，与 Cursor、DeepSeek 官方无隶属关系。
