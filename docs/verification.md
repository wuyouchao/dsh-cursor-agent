# 0.1.0 验证步骤与记录

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
| A10  | `npm pack` 检查含服务端与客户端产物；使用 Desktop pnpm 11、全新空 store、allowBuilds: {} 与 ignoreScripts: false 安装后入口可加载；包无 prepare/install 构建脚本；tgz 与固定提交 Git 安装分别记录 | tgz干净安装自动验证通过，详见下方证据；固定SHA Git安装待调度者提交后执行。                                                                      |

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

当次 tgz SHA256：`4329356A4A071FB53C9FF62C7833DC63BAB8E0F91B70F1C0EAC5FDFEDC3123B1`。本机执行命令、环境与摘要保存在该 fixture 的 `evidence.txt`，原生命令结果见本次执行工具记录；验证脚本为 `verify.mjs`。本记录证明预编译 tgz 可安装和加载；固定提交 SHA 的 Git 安装尚待提交后另行验证，不等同于 Desktop UI、真实授权或真实对话通过。

此摘要仅对应当次 tgz 字节；随后文档或构建产物变化会改变包摘要。最终远端固定提交 SHA 的 Git 安装需另行验证。
