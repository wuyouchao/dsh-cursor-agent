# dsh-cursor-agent

为 DeepSeek Harness 接入 Cursor 官方 SDK、账号登录与原生 Agent 能力。

**当前处于初始化阶段。** 已提供可由 Cordis 加载的插件入口、SDK 认证命令、开发检查和接口研究；尚不能在 Harness 界面中与 Cursor 对话。插件加载只输出诊断，不替换已有 Agent。

## 接入方向

```text
DeepSeek Harness Web UI
  → Cursor AgentFactory 适配层（待开发）
  → Cursor SDK 本地 Agent
  → 本地工作区 + Cursor 云端模型
```

目标是由 Cursor 执行 Agent 循环、文件编辑和工具调用，Harness 提供界面、会话列表与展示。事件桥接不再次执行已经由 Cursor 执行过的工具。

这个方向依据[官方 Harness 插件接口](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop)与 [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)核实，接口与接入方案见下方研究文档。

## 开发

使用 Node.js 24 和 npm。当前兼容目标为 Harness `0.2.1-rc.2`、Cordis `4.0.5`、Cursor SDK `1.0.40`。这里只表示研究与构建基线，尚未完成完整 Harness Web 集成验收。

```sh
npm ci
npm run check
```

`check` 执行类型检查、格式检查、离线测试和生产构建。默认测试不登录 Cursor、不调用模型。

## 从 GitHub 安装

需要 Node.js 24、Git、可用的 pnpm，以及已有的 Harness `0.2.1-rc.2` Web profile。**无需安装 Cursor 桌面版，也无需手动安装 Cursor SDK**；包管理器会自动安装 `@cursor/sdk` 依赖。

```sh
dsh plugin --profile web add github:wuyouchao/dsh-cursor-agent#main
```

仓库中的 `prepare` 脚本会在 Git 安装时编译入口。若 pnpm 提示不允许构建，在该 profile 的 `pnpm-workspace.yaml` 中合并以下配置，然后重试安装。默认位置为 `~/.dsh/profiles/web/pnpm-workspace.yaml`，设置了 `DSH_HOME` 时以实际目录为准。保留文件原有内容；若 pnpm 输出的包标识不同，以其提示为准。

```yaml
allowBuilds:
  dsh-cursor-agent: true
```

可把 `#main` 换成具体提交 SHA，固定安装的代码版本。安装后重启对应 Harness 实例。**本版本仅验证基础插件加载，尚未提供 Cursor 对话、模型选择器和界面登录按钮。**

安装到 profile 后，可通过以下命令使用认证工具：

```sh
dsh plugin --profile web exec dsh-cursor-agent-auth login
dsh plugin --profile web exec dsh-cursor-agent-auth status
dsh plugin --profile web exec dsh-cursor-agent-auth logout
```

安装机制参见[官方 GitHub 安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/user/develop/basic/publish.md#installing-from-github-the-build-script-catch)。

## Cursor 登录

在源码目录完成 `npm ci` 后，也可以运行以下命令。若本机全局禁用了安装脚本，先手动执行 `npm run build` 生成入口。

```sh
npm run login
npm run auth:status
npm run logout
```

登录使用官方 SDK 的浏览器流程，支持 Ctrl+C 取消。CLI 只展示账号及过期信息，不输出 API Key。

- SDK 默认保存登录到 `~/.cursor/sdk/auth.json`，不自动继承 Cursor 桌面端登录。
- `auth:status` 查询 **SDK 保存的登录状态**，不代表远端密钥有效，也不反映 `CURSOR_API_KEY`。
- `logout` 清除 SDK 保存的凭据，不撤销远端 Key，也不修改环境变量。
- 也可自行设置 `CURSOR_API_KEY`；`.env.example` 仅作参考，命令不会自动读取 `.env`。

这些命令是初始化提供的认证工具，不代表已经接通 Harness 中的登录按钮或 Agent 运行。

## 本地打包

```sh
npm pack
```

生成的 `.tgz` 包含编译产物和 `cordis.patch.yml`。如需在已有、可用的 Harness `web` profile 验证加载，可执行：

```sh
dsh plugin --profile web add ./dsh-cursor-agent-0.0.1.tgz
```

这会修改该 profile。重启相应 Harness 实例后，入口只记录“桥接尚未启用”。初次创建 profile 不会自动得到 Web UI，需遵循官方 profile 初始化流程。当前没有发布 npm 包，`private: true` 用于阻止误发布。

## 研究和计划

- [Harness 插件开发接口](docs/research/deepseek-harness.md)
- [Cursor SDK 接口与认证](docs/research/cursor-sdk.md)
- [接入架构与分阶段验收](docs/architecture.md)

## 当前边界

原生 AgentFactory、动态模型目录、会话恢复、事件转换、界面登录和权限策略均待实现。Cursor 的工具事件不能直接视为 Harness 审批回调；Windows SDK 包存在，但本机沙箱执行及真实账号调用仍待实测。

## 许可证

本项目代码采用 [MIT](LICENSE)；许可证保留标准英文原文。Cursor SDK 使用其自身许可与服务条款。本项目为独立社区项目，与 Cursor、DeepSeek 官方无隶属关系。
