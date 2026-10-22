import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import type { CursorAccountStore } from "./store.js";
import { copyLoginUrl, safeLoginUrl } from "./browser.js";
export { safeLoginUrl } from "./browser.js";

const card: CSSProperties = {
  maxWidth: 720,
  padding: "16px",
  borderRadius: "var(--dsw-radius-xl, 12px)",
  border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
  background: "var(--dsw-alias-settings-card-fill)",
  color: "var(--dsw-alias-label-primary)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const secondary: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-label-tertiary)",
};

/** 只通过已脱敏的 Host 状态展示认证和模型目录。 */
export function CursorAccountCard({
  controller,
}: {
  controller: CursorAccountStore;
}) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    const unmount = controller.mount();
    void controller.refresh();
    return unmount;
  }, [controller]);
  const state = snapshot.state;
  const waiting = state?.status === "waiting" || state?.status === "verifying";
  const url = safeLoginUrl(state?.loginUrl);
  const error = snapshot.error ?? state?.error?.message;
  return (
    <section style={card} aria-label="Cursor 账号">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
          Cursor 账号
        </h3>
        <span style={secondary}>
          {!state
            ? "正在读取状态…"
            : state.status === "connected"
              ? "连接成功"
              : state.status === "waiting"
                ? "等待浏览器授权"
                : state.status === "verifying"
                  ? "正在验证连接…"
                  : state.status === "error"
                    ? "连接失败"
                    : "未登录"}
        </span>
      </div>
      {state?.email && (
        <p style={{ margin: 0, overflowWrap: "anywhere" }}>{state.email}</p>
      )}
      <p style={secondary}>登录后，在普通聊天的模型菜单中选择 Cursor 模型。</p>
      {state?.credentialSource === "environment" && (
        <p style={secondary}>
          当前使用 CURSOR_API_KEY
          环境变量，其优先于保存的登录。退出仅清除保存的登录，环境变量仍然有效。
        </p>
      )}
      {state?.credentialSource === "saved" && (
        <p style={secondary}>退出会清除此设备保存的登录。</p>
      )}
      {state?.status === "waiting" && (
        <p style={secondary}>
          请在浏览器完成授权。关闭此页面会停止状态观察，登录仍可继续。
        </p>
      )}
      {state?.status === "verifying" && (
        <p style={secondary}>正在核对账号与模型目录，请稍候。</p>
      )}
      {error && (
        <p
          role="alert"
          style={{ ...secondary, color: "var(--dsw-alias-state-warn-label)" }}
        >
          {error}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        {!waiting && state?.status !== "connected" && (
          <Button
            disabled={snapshot.busy || !state}
            onClick={() => void controller.login()}
          >
            登录 Cursor
          </Button>
        )}
        {waiting && url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            打开浏览器
          </a>
        )}
        {waiting && url && (
          <Button
            disabled={snapshot.busy}
            onClick={() => {
              void copyLoginUrl(url).then(setCopyStatus);
            }}
          >
            复制链接
          </Button>
        )}
        {waiting && state.attemptId && (
          <Button
            disabled={snapshot.busy}
            onClick={() => void controller.cancel(state.attemptId!)}
          >
            取消登录
          </Button>
        )}
        {!waiting && (
          <Button
            disabled={snapshot.busy}
            onClick={() => void controller.refresh()}
          >
            {snapshot.busy ? "处理中…" : "刷新状态"}
          </Button>
        )}
        {state && !waiting && state.credentialSource !== "none" && (
          <Button
            disabled={snapshot.busy}
            onClick={() => void controller.logout()}
          >
            退出登录
          </Button>
        )}
        <span role="status" style={secondary}>
          {copyStatus}
        </span>
      </div>
      {state?.status === "connected" && (
        <>
          <p style={secondary}>
            登录验证通过，已读取 {state.models.length} 个 Cursor 模型。
          </p>
          {state.models.length > 0 && (
            <details>
              <summary>查看模型目录</summary>
              <ul
                style={{
                  margin: "8px 0 0",
                  paddingLeft: 20,
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {state.models.map((model) => (
                  <li key={model.id} style={{ overflowWrap: "anywhere" }}>
                    {model.displayName}{" "}
                    <span style={secondary}>（{model.id}）</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
