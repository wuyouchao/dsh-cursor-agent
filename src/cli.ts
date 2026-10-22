#!/usr/bin/env node
import { createCursorAuth } from "./cursor/auth.js";

const HELP = `Cursor SDK 认证命令：
  dsh-cursor-agent-auth login   使用浏览器登录 Cursor，保存 SDK 凭据
  dsh-cursor-agent-auth status  查看 SDK 保存的登录状态
  dsh-cursor-agent-auth logout  清除 SDK 保存的登录

在源码目录也可使用 npm run login / npm run auth:status / npm run logout。

凭据由官方 SDK 保存在 ~/.cursor/sdk/auth.json，不读取 Cursor 桌面账号登录。
状态检查不验证远端有效性，也不检查 CURSOR_API_KEY 环境变量。`;

function formatExpiry(value: number): string {
  return new Date(value).toLocaleString("zh-CN");
}

async function main(args: string[]): Promise<number> {
  const [command] = args;
  if (
    args.length === 0 ||
    (args.length === 1 && ["-h", "--help", "help"].includes(command ?? ""))
  ) {
    console.log(HELP);
    return 0;
  }
  if (
    args.length !== 1 ||
    !["login", "status", "auth:status", "logout"].includes(command ?? "")
  ) {
    console.error("命令无效。\n" + HELP);
    return 1;
  }

  // 帮助和参数检查无需加载 SDK；认证只在用户执行对应命令时触发。
  const { Cursor } = await import("@cursor/sdk");
  const auth = createCursorAuth(Cursor.auth);

  if (command === "login") {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    try {
      console.log("正在启动 Cursor 浏览器登录。可按 Ctrl+C 取消。\n");
      const result = await auth.login({
        signal: controller.signal,
        openBrowser: true,
        onLoginUrl: (url) => console.log(`请在浏览器完成登录：\n${url}\n`),
      });
      console.log("登录成功，官方 SDK 已保存凭据。");
      if (result.email !== undefined) console.log(`账号：${result.email}`);
      console.log(`凭据过期时间：${formatExpiry(result.apiKeyExpiresAtMs)}`);
      return 0;
    } catch (error) {
      if (controller.signal.aborted) {
        console.error("登录已取消。");
        return 130;
      }
      throw error;
    } finally {
      process.removeListener("SIGINT", cancel);
    }
  }

  if (command === "logout") {
    await auth.logout();
    console.log("已清除 SDK 保存的登录。");
    console.log("此操作不撤销远端 API key，也不清除 CURSOR_API_KEY 环境变量。");
    return 0;
  }

  const status = await auth.status();
  if (status.status === "logged-out") {
    console.log("SDK 未保存登录，或保存的登录已过期。");
  } else {
    console.log("SDK 已保存未过期的登录。");
    if (status.email !== undefined) console.log(`账号：${status.email}`);
    console.log(`服务地址：${status.backendUrl}`);
    if (status.apiKeyExpiresAtMs !== undefined) {
      console.log(`凭据过期时间：${formatExpiry(status.apiKeyExpiresAtMs)}`);
    }
  }
  console.log(
    "以上仅为保存的登录状态，未验证远端有效性，也未检查 CURSOR_API_KEY。",
  );
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(
    `认证操作失败：${error instanceof Error ? error.message : "未知错误"}`,
  );
  process.exitCode = 1;
}
