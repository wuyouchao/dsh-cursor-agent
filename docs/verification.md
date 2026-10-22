# 验证记录：0.1.x 历史与 0.2.0 独立任务

当前 0.2.0 使用独立 Cursor 账号与任务运行域，bundle patch 仅插入本插件，不再停用官方 Agent、模型或预设。下方 A1–A10 及 0.1.1 节是历史发布验收，专用 profile 与全局 factory 的描述不代表当前设计；当前新增证据见末尾 Host 共享模块与预设作用域回归。

本记录区分离线自动验证和真实环境验收。未填写证据的项目一律视为待完成；编译通过不代表真实账号、Desktop 或计费对话成功。

## 自动验证清单

| 编号 | 验证步骤与断言                                                                                                                                                                                    | 状态/证据                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | `npm run check`：严格类型、格式、离线测试、生产构建均通过                                                                                                                                         | 最终依赖整理后执行通过：55/55测试、严格类型、格式检查及生产构建全部通过。                                                                       |
| A2   | 真实 Harness Context/服务 fixture 装载插件，确认 Typert 方法与事件契约、客户端入口及 dispose 生命周期                                                                                             | 自动验证通过：runtime-factory 完整入口测试挂载真实服务并断言账号/目录/唯一factory/卸载；integration-contract 核对生成契约和lazy客户端注册。     |
| A3   | 离线认证：未登录、登录中、成功、失败、取消、退出、重复登录；完成或取消交错不得写回过期状态                                                                                                        | 自动验证通过：account-controller 与 client-account 离线测试；真实浏览器授权未执行。                                                             |
| A4   | 安全：SDK 返回包含哨兵 Key 时，状态 DTO、事件、错误和日志均不暴露；不读取私有凭据文件                                                                                                             | 自动验证通过：认证安全DTO及SDK异常哨兵回归；宿主显式投影，不能依赖Typert出站schema过滤。                                                        |
| A5   | 动态模型：加载与错误有显式状态；模型 ID/参数进入原生 Agent；不支持模型或操作明确报错                                                                                                              | 自动验证通过：runtime-catalog 与factory替身模型参数传递；真实账号目录未请求。                                                                   |
| A6   | 原生 Agent：多轮使用同一 agent；增量与最终消息一致；工具事件只展示且不重复执行；缺 checkpoint 拒绝伪恢复                                                                                          | 自动验证通过：runtime-events 和runtime-factory；官方JSONL后端关闭后恢复原历史并续聊，无重复事件。SDK执行仍为替身。                              |
| A7   | 取消：create/send/stream/wait 边界与并发取消；结束后不遗留运行；卸载期间停止新请求并释放资源                                                                                                      | 自动验证通过：create晚返回、owner取消、send晚返回、cancel/wait双门控、人工交互取消挂起5秒明确失败并停用Agent。不可取消SDK永久挂起不宣称已停止。 |
| A8   | 专用 Cursor 模式：默认 Agent loop 不与 Cursor factory 同时注册；相关后台 LLM 任务无冲突；模型选择与运行一致                                                                                       | 自动验证通过：真实注册表拒绝第二factory，真实patch合成停用冲突目标，模型参数传入SDK替身。Desktop整套启动未执行。                                |
| A9   | bundle patch：添加/删除补丁后配置可恢复；不覆盖无关用户配置，不冒用 DeepSeek namespace                                                                                                            | 自动验证通过：真实composeEntries添加/移除bundle层还原基底及原模型参数，无关配置保持原值。                                                       |
| A10  | `npm pack` 检查含服务端与客户端产物；使用 Desktop pnpm 11、全新空 store、allowBuilds: {} 与 ignoreScripts: false 安装后入口可加载；包无 prepare/install 构建脚本；tgz 与固定提交 Git 安装分别记录 | tgz与远端固定代码SHA Git安装均通过，详见下方独立证据；未执行Desktop GUI或真实账号运行。                                                         |

## 用户真实环境验收（本次未执行）

1. 在 Harness `0.2.1-rc.2` 的专用验证 profile 安装固定提交的 Git 包，确认安装直接使用 `dist/`，启用插件后能打开 Cursor 设置。
2. 从页面发起 Cursor 官方浏览器授权，分别验证完成与取消；刷新页面确认 SDK 状态。本地 stored 状态单独展示；连接成功须验证远端 me 与 models，不能据此宣称真实对话成功。
3. 加载真实账号模型目录并选择模型，核对新会话所用模型；模型目录失败应显示真实错误。
4. 在临时工作区发送只读请求，观察流式文本与工具展示，继续第二轮，再取消运行。此步骤可能产生费用，由用户自行执行。
5. 重启专用实例并恢复同一会话，核对上下文；在缺失 checkpoint 的独立测试副本中确认明确失败。
6. 卸载插件后确认专用模式修改撤销，基底配置恢复，活动任务终止且没有重复 factory。

以上各项当前均为真实未验证，不修改现有用户 profile，不自动授权或调用计费模型。

## 安装验证约束

包安装使用临时空目录与全新 pnpm store，保留 Desktop pnpm 11 的生命周期脚本审批设置（allowBuilds: {}、ignoreScripts: false），不得用 --ignore-scripts 掩盖 Git prepare 问题。本轮先验收 tgz；调度者完成提交后，另以固定本地 Git 提交或远端 SHA 验证 Git 安装。

## 已执行的独立回归

- node --import tsx --test test/runtime-factory.test.ts：11/11通过（含5秒收尾超时场景）。
- node --import tsx --test test/integration-contract.test.ts：3/3通过。
- npx tsc --noEmit：通过。

完整入口测试等待真实子fiber与目录注册；test/plugin.test.ts仅证明依赖缺失时等待与卸载安全，不算插件已启用证据。

## A10：Desktop 运行时隔离 tgz 预检

2026-10-22 使用 Desktop 自带 Node **24.21.0** 与 pnpm **11.28.5**，在仓库外临时目录 `I:/dsh-cursor-agent-install-temp/55eb5e5fab19417a8fffdbdb6431eaba` 安装当次构建的 tgz。已确认祖先目录不存在 `node_modules`，并清除当前进程的 `NODE_PATH`，防止借用开发依赖。每次尝试均使用新 fixture 和新 store。系统 TEMP 的祖先存在用户 node_modules，因此未将较早的 TEMP 尝试计入最终通过证据。

fixture 的依赖只有 `dsh-cursor-agent` 本地 tgz 与宿主 `@deepseek-ai/cordis@4.0.5`，配置为：

```yaml
nodeLinker: hoisted
autoInstallPeers: false
allowBuilds: {}
ignoreScripts: false
```

以 Desktop 的 `dependencies/node/bin/node.exe` 执行 `dependencies/pnpm/bin/pnpm.cjs install --store-dir ./isolated-store --reporter append-only`：安装29包完成，没有生命周期构建审批阻断；`pnpm peers check` 返回 `No peer dependency issues found`，退出码0。未使用 `--ignore-scripts`。

以下检查均通过：根入口、`/auth`、`/typert`、`/remote`、`/shared/account` 动态导入；Cursor SDK 导入；`/client` 文件及 lazy-CJS 工厂注册；CLI `--help`；第三方许可存在；包无 prepare、preinstall、install、postinstall 或 prepack 脚本。只导入 SDK，不执行登录、模型目录请求或付费模型。

当次 tgz SHA256：`4329356A4A071FB53C9FF62C7833DC63BAB8E0F91B70F1C0EAC5FDFEDC3123B1`。本机执行命令、环境与摘要保存在该 fixture 的 `evidence.txt`，原生命令结果见本次执行工具记录；验证脚本为 `verify.mjs`。本记录证明预编译 tgz 可安装和加载；该tgz预检不等同于 Desktop UI、真实授权或真实对话通过；固定SHA Git结果另见下节。

此摘要仅对应当次 tgz 字节；随后文档或构建产物变化会改变包摘要。固定代码SHA的远端Git安装已独立验证，证据见下节。

## A10：远端固定代码 SHA 的 Git 安装

2026-10-22 对已推送代码提交 [641885d41a0dfeefc20ae294e0d4dded4cc65220](https://github.com/wuyouchao/dsh-cursor-agent/commit/641885d41a0dfeefc20ae294e0d4dded4cc65220) 独立验证通过。fixture 位于仓库外 `I:/dsh-cursor-agent-install-temp/git-6da8e3ceddeb4263a3753902f317197f`，无祖先 node_modules，NODE_PATH已清除，使用新的空store。Desktop Node `24.21.0`、pnpm `11.28.5`；仍启用 `nodeLinker: hoisted`、`autoInstallPeers: false`、`allowBuilds: {}`、`ignoreScripts: false`。

fixture只有两个直接依赖：宿主 `@deepseek-ai/cordis@4.0.5` 与 `github:wuyouchao/dsh-cursor-agent#641885d41a0dfeefc20ae294e0d4dded4cc65220`。pnpm锁文件的specifier与codeload tarball均指向此完整SHA，未使用浮动main。

以下命令用 Desktop 自带 node.exe 执行 pnpm.cjs；原生命令的stdout/stderr显式捕获：

```powershell
& $DesktopNode $DesktopPnpm install --store-dir ./isolated-store --reporter append-only 2>&1 | Tee-Object install-output.txt
& $DesktopNode verify.mjs 2>&1 | Tee-Object verify-output.txt
& $DesktopNode node_modules/dsh-cursor-agent/dist/cli.js --help 2>&1 | Tee-Object cli-output.txt
& $DesktopNode $DesktopPnpm peers check 2>&1 | Tee-Object peers-output.txt
```

安装29包、4.8秒完成，退出码0，没有prepare/install构建脚本审批阻断。根入口、auth、typert、remote、shared/account、SDK导入、client文件及lazy工厂注册、预编译产物/许可/无安装脚本断言全部通过；CLI帮助退出0；peer检查输出 `No peer dependency issues found`，退出码0。日志与verify.mjs保存在上述fixture；已核实输出文件非空。未登录、未读取账号状态、未请求模型目录、未进行付费对话，也未修改用户profile。

该SHA是已验证的代码提交；本节证据属于之后的独立文档更新，不改变已验代码SHA。

## 0.1.1 配置缺省加载回归

用户在真实 Desktop 启用 0.1.0 时报告 `ValidationError: expected object, received undefined`。独立复现直接加载之前干净 Git 安装的 0.1.0 `dist/index.js`，挂载真实 SessionStore、AgentRegistry、TypertRegistry、LlmRuntime、SessionProjectionRegistry 与持久化服务后，以 `ctx.plugin(plugin)` 不传配置启动。`fiber.await()` 报错原文为：

```text
TypeError [ValidationError]: invalid config:
  - Invalid input: expected object, received undefined (at )
```

调用栈进入 Cordis `resolveConfig → Fiber._resolveConfig → Fiber._reload → Fiber.await`。根因是生产导出的根 `Config` 只接受对象，而 bundle patch 的插件 entry 没有 `config`；Cordis 在执行 `apply` 之前校验，因此 `apply(ctx, config = {})` 无法补救根校验失败。

之前的检查存在两个盲点：缺依赖测试只验证等待与卸载，`fiber.assertActive()` 并不证明已完成插件初始化；完整入口测试虽然挂载真实依赖，却总是显式传入 `{ stateDirectory }`，漏掉实际安装产生的无配置入口。类型检查、CI或干净安装导入成功也不能证明无配置插件已激活。

0.1.1 对根配置提供预填对象，并在 bundle patch 显式给出空配置。新增回归同时加载源码和打包的生产默认导出，各覆盖五种路径：完全省略参数、从实际 `cordis.patch.yml` 经官方 `composeEntries` 提取 entry.config、空对象、显式 `shell`/`sandboxEnabled: false`、非法字段类型。成功路径必须到达真实 `ACTIVE` 状态，并验证账号服务、Cursor目录、唯一factory注册与卸载；显式权限保持原值。非法配置必须在 `fiber.await()` 拒绝并处于 `FAILED`，且未注册账号、目录或factory。

修复后的定向命令 `node --import tsx --test --test-name-pattern '生产.*入口真实依赖配置路径' test/runtime-factory.test.ts` 为 **10/10通过**；`npx tsc --noEmit` 与测试文件格式检查通过。此处使用真实 Harness 生命周期与配置校验，未调用 SDK 认证、模型或Agent，也未修改用户 profile。最终全量检查、0.1.1包安装和用户Desktop再次启用结果须各自记录，不能从这10项通过推断真实授权或计费运行成功。

0.1.1 最终全量检查：构建任务执行 npm run check，65/65测试通过，类型、格式与生产构建均通过（包含上述10项生产入口配置矩阵）。此结果修正了0.1.0省略配置的覆盖缺口；尚待用户Desktop重新启用验证。

## A10：0.1.0 原地升级至版本标签 v0.1.1

2026-10-22 在新的仓库外隔离目录 `I:/dsh-cursor-agent-install-temp/upgrade-3851276dc00d4ea7a361207f17b4f515` 验证，无祖先 node_modules，NODE_PATH清空。没有变更之前的证据fixture或用户profile。使用 Desktop Node `24.21.0`、pnpm `11.28.5`，升级profile保持 `nodeLinker: hoisted`、`autoInstallPeers: false`、`allowBuilds: {}`、`ignoreScripts: false`，初始使用全新store。

实际调用与官方CLI相同的 `@deepseek-ai/dsh-plugin-manager/operations` 公共 `runProfilePnpm`，不是仅模拟pnpm。Desktop的该JS模块位于app.asar而非可直接导入的unpacked目录，因此在独立工具fixture安装了精确官方 `@deepseek-ai/dsh-plugin-manager@0.2.1-rc.2`，以明确的 `context.dir` 指向临时profile、`context.home` 指向临时home，执行真实兼容性校验与bundle选择reconcile。

依次执行以下参数，过程中没有remove或卸载操作：

```text
runProfilePnpm(context, ["add", "github:wuyouchao/dsh-cursor-agent#641885d41a0dfeefc20ae294e0d4dded4cc65220", "--store-dir=<fixture>/profile-store", "--reporter=append-only"], options)
runProfilePnpm(context, ["add", "github:wuyouchao/dsh-cursor-agent#v0.1.1", "--store-dir=<fixture>/profile-store", "--reporter=append-only"], options)
```

两次退出码均为0，分别安装0.1.0和原地更新为0.1.1；pnpm锁文件把 `v0.1.1` 解析到代码提交 [3d09c484b64d8c890d40685c3bb3850dd3db77f7](https://github.com/wuyouchao/dsh-cursor-agent/commit/3d09c484b64d8c890d40685c3bb3850dd3db77f7)。原有bundle选择 `[fixture-base, dsh-cursor-agent]`、profile自定义字段、无关偏好和 `cordis.patch.yml` 字节均保留。新版本根入口、auth、typert、remote导入通过；`Config.parse(undefined)` 得到只读权限与启用沙箱，显式shell/false配置保持原值。未调用账号认证、模型或Agent。

执行脚本为fixture的 `tooling/upgrade.mjs`，所有原生stdout/stderr经 `2>&1 | Tee-Object` 保存至 `upgrade-output.txt`；官方操作另各自产生 `profile/.plugin-manager/logs/operation-*/pnpm.log`。这证明官方包管理公共操作支持无需卸载的原地升级；不等同于用户Desktop GUI再次启用或真实授权通过。修复代码的 [GitHub Actions run 39740793448](https://github.com/wuyouchao/dsh-cursor-agent/actions/runs/39740793448) 的Windows和Linux检查均成功。

## Host 共享模块与预设作用域回归

后续实机报告标准预设无法加载：`deployment:persona-prefix` 已注册，以及 standing `modelSelectionSettings` 缺少 scoped preset Context。官方预设注册会立即挂载常驻组合；设置页列表读取其诊断，查看配置只导出 YAML，并不会建立另一个预览 Agent。真实会话绑定同样检查该诊断，因此不能将此错误视为只影响设置页预览。

独立回归 `test/host-integration.test.ts` 使用两个临时物理依赖树，并通过官方公开 `createRuntimeResolution` 与 `PluginPackages` 安装真实 Host/profile 解析器。旧树复制真实发布的 `dsh-scope`、`dsh-system-prompt` 包到 profile 本地依赖；新树不含这些副本。测试检查实际 `packageOf` 解析路径和模块函数身份，不使用假 Context 或 ESM query 来代替安装解析。

旧树中 profile 的 scope 与 Host scope 函数不是同一实例，无法读取 Host 创建的 scope tag；真实 Loader、SystemPrompt、AgentPresetRegistry、Persona 挂载因此重现 `deployment:persona-prefix ... already registered`，roster 标为 broken，真正的预设 mount 也拒绝。新树由 peer 回退至 Host 的同一实例，预设真实挂载成功，人设仅覆盖该 scope，全局人设保持原值。manifest 回归同时禁止在生产 dependencies 重新加入 Host 的 `@deepseek-ai/*` 服务定义包，并检查 peer 与开发验证版本一致。

该最小双树模型复现模块身份问题及同一 persona 症状，不能等同于完整旧 Desktop 的全部 bundle 启动。实际安装的旧依赖清理、完整UI运行和用户再次验证须单独记录；上述测试不登录、不执行模型或文件工具、不修改现有 profile。当前定向测试3/3通过；后续全量检查和更多子Agent作用域覆盖以实际结果更新。

当前实现复查：cordis.patch.yml 只有 insert 与 config:{}；src/index.ts 不再调用 applyRuntime 或注册全局 factory/LLM adapter，转为独立运行域与 cursorTasks 服务。最新树的 Host 共享模块定向回归再次3/3通过。完整产物及升级验证见下节。

## 0.2.0 独立菜单、任务与原地升级验收

2026-10-22 执行 `npm run check`：Typert 生成、严格类型、格式、生产构建均通过，**87/87 离线测试通过**，无跳过。日志保存在 `.local/pack-check/v0.2.0-check-output.txt`。源码与 dist 入口分别覆盖省略配置、实际 patch、空对象、显式权限和非法配置；真实 ACTIVE 状态下账号及任务服务就绪，预先注册的模型 adapter 与 factory 保持不变。真实 JSONL 回归覆盖多轮文本、工具宣告与记录、关闭后恢复、取消、缺 checkpoint 及不可继续状态。SDK 使用离线替身，未调用付费模型。

客户端 15 项测试包含账号订阅共享、重连代际、任务选择、取消标识和模型请求永不结算时仍可读取本机历史。额外使用真实官方 Context、SlotRegistry 和 ClientRemote 挂载客户端：`settings.section` 的 `cursor`、`sidebar.panellist` 的 `cursor-tasks` 与 keyed `main` 配对成功，账号 store 共用，注册阶段零 RPC，卸载后所有入口移除。证据为 `.local/ui-preview/real-menu-verification.json`。真实组件和官方 Button 的离线页面通过 Edge 截图，覆盖未登录、模型就绪、运行中、离线历史和不可继续状态；375 与 1000 像素宽度均无水平溢出，共七张截图，指标位于 `.local/ui-preview/tasks-metrics.json`。这些是隔离页面和真实插槽的验证，不是用户 Desktop 全应用的实机截图。

在新的仓库外目录 `I:/dsh-cursor-agent-install-temp/v020-final-cbca03fbf69c4c9aa19d47a259490efb`，使用 Desktop Node 24.21.0、pnpm 11.28.5 与官方 `runProfilePnpm`，从 Git 标签 `v0.1.1` 原地升级到本地最终代码 tgz `0.2.0`。保持 `nodeLinker: hoisted`、`autoInstallPeers: false`、`allowBuilds: {}`、`ignoreScripts: false`，清空 NODE_PATH，使用新 store；没有卸载步骤。两次安装退出码均为 0，新版移除 23 个不再需要的 Host 包，profile 中原有 scope/agent/system-prompt/Cordis 等副本消失，bundle 选择、无关配置和自定义 patch 保留。日志为该目录的 `migration-output.txt`。此时 tgz SHA256 为 `C710EF47A4ACEAC44FE7A3BAF2DF3620216AF673765BA08278019EAF710AB4CE`；之后仅补充本文档，不改变已验代码及编译产物。

随后通过真实 `PluginPackages` 与 `createRuntimeResolution` 导入并激活升级后的完整安装入口，达到 ACTIVE，`cursorAccount`、`cursorTasks` 就绪，插件与安装域 scope/agent 函数严格同一实例；已有 adapter 和 factory 的身份保持不变，插件卸载只移除自身服务。脚本为 `.local/pack-check/verify-v020-resolver.mjs`，日志为 fixture 的 `full-resolver-output.txt`。安装域使用仓库中精确版本的官方 Host 包，未启动 Desktop ASAR 全应用。纯 profile 的 pnpm 缺 Host peer 警告符合关闭自动安装 peer 的预期，实际依赖由 Harness 的解析器提供，不能用裸 Node 导入或 `pnpm peers check` 替代此项验证。

同一隔离 fixture 进一步使用官方 `runProfilePnpm` 安装固定 Git 提交 `2acac0b96178c3b471fa0d82e93f963860fdcacc`，退出码 0，版本为 0.2.0，锁文件解析到该 SHA，没有 prepare 审批阻断；安全安装策略、bundle 与无关配置保留。Git 安装后的完整入口再次经官方解析器激活，账号及任务就绪，已有 adapter/factory 保持不变。独立日志为 `git-install-output.txt` 与 `git-full-resolver-output.txt`，未覆盖此前 tgz 验证日志。该代码提交之后仅修正跨平台测试路径并补充文档，生产源码及编译产物不变。

本次未修改用户真实 profile，未执行浏览器授权、真实账号目录请求、付费对话或 SDK Windows 沙箱实测。新建未发送的任务没有有效 checkpoint 时，重启后显示“不可继续”；恢复检查不会创建空 Agent 冒充成功。
