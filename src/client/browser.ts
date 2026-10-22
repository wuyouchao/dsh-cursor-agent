/** 认证链接只允许官方 HTTPS 域，不允许凭据和自定义端口。 */
export function safeLoginUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "cursor.com" || url.hostname.endsWith(".cursor.com"))
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** 剪贴板缺失、同步拒绝和异步拒绝都转为用户可见反馈。 */
export async function copyLoginUrl(
  url: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = globalThis.navigator
    ?.clipboard,
): Promise<string> {
  try {
    if (!clipboard) throw new Error("clipboard unavailable");
    await clipboard.writeText(url);
    return "链接已复制";
  } catch {
    return "复制失败，请使用“打开浏览器”。";
  }
}
