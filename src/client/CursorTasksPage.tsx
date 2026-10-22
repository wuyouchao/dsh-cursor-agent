import { useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import { CursorAccountCard } from "./CursorAccountCard.js";
import type { CursorAccountStore } from "./store.js";
import { isAbsoluteWorkspace } from "./tasks-store.js";
import type { CursorTasksStore } from "./tasks-store.js";

const box: CSSProperties = {
  border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
  borderRadius: 12,
  padding: 16,
  background: "var(--dsw-alias-settings-card-fill)",
  minWidth: 0,
};
const control: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--dsw-alias-settings-card-stroke)",
  borderRadius: 8,
  padding: "8px 10px",
  font: "inherit",
  background: "var(--dsw-alias-settings-card-fill)",
  color: "var(--dsw-alias-label-primary)",
};
const note: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: "20px",
  color: "var(--dsw-alias-label-tertiary)",
};
const row: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};
const statusLabel = (status: string): string =>
  ({
    running: "运行中",
    stored: "待恢复",
    unavailable: "不可继续",
    idle: "就绪",
  })[status] || "状态未知";

export function CursorTasksPage({
  controller,
  account,
}: {
  controller: CursorTasksStore;
  account: CursorAccountStore;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [cwd, setCwd] = useState("");
  const [model, setModel] = useState("");
  const [text, setText] = useState("");
  const [validation, setValidation] = useState("");
  useEffect(() => controller.mount(), [controller]);
  const selected = state.selected;
  const chosenModel = state.models.some((item) => item.id === model)
    ? model
    : state.models[0]?.id || "";
  const busy = state.action !== undefined;
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!isAbsoluteWorkspace(cwd)) {
      setValidation(
        "请输入工作区的绝对路径，例如 I:\\project 或 /home/user/project。",
      );
      return;
    }
    if (!chosenModel) {
      setValidation("请先登录 Cursor 并选择可用模型。");
      return;
    }
    setValidation("");
    void controller.create({ cwd: cwd.trim(), model: chosenModel });
  };
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !text.trim()) return;
    const prompt = text.trim();
    void controller.send(selected.id, prompt).then(() => {
      if (!controller.getSnapshot().error) setText("");
    });
  };
  return (
    <div
      style={{
        height: "100%",
        overflow: "auto",
        boxSizing: "border-box",
        padding: "24px clamp(12px, 3vw, 32px)",
        color: "var(--dsw-alias-label-primary)",
      }}
    >
      <main
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        <header>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Cursor 任务</h1>
          <p style={note}>
            在指定工作区使用 Cursor 执行任务。任务记录与普通聊天分别保存。
          </p>
        </header>
        <details style={box}>
          <summary style={{ cursor: "pointer" }}>Cursor 账号与登录</summary>
          <div style={{ marginTop: 12 }}>
            <CursorAccountCard controller={account} />
          </div>
        </details>
        {(state.error || validation) && (
          <p
            role="alert"
            style={{ ...note, color: "var(--dsw-alias-state-warn-label)" }}
          >
            {validation || state.error}
          </p>
        )}
        <section style={box} aria-label="创建 Cursor 任务">
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>新建任务</h2>
          <form
            onSubmit={create}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <label>
              工作区绝对路径
              <input
                style={{ ...control, marginTop: 6 }}
                value={cwd}
                onChange={(event) => setCwd(event.target.value)}
                placeholder="例如 I:\project 或 /home/user/project"
                required
                disabled={busy}
              />
            </label>
            <label>
              模型
              <select
                style={{ ...control, marginTop: 6 }}
                value={chosenModel}
                onChange={(event) => setModel(event.target.value)}
                required
                disabled={busy || state.models.length === 0}
              >
                {state.models.length === 0 && (
                  <option value="">暂无可用模型，请登录后刷新</option>
                )}
                {state.models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={row}>
              <Button
                type="submit"
                disabled={busy || !cwd.trim() || !chosenModel}
              >
                {state.action === "create" ? "正在创建…" : "创建任务"}
              </Button>
              <Button
                disabled={state.loading}
                onClick={() => void controller.refresh()}
              >
                {state.loading ? "正在刷新…" : "刷新任务与模型"}
              </Button>
              <span style={note}>默认只读；创建后输入需求才会开始运行。</span>
            </div>
          </form>
        </section>
        <section
          style={{ ...box, display: "flex", flexDirection: "column", gap: 12 }}
          aria-label="Cursor 任务记录"
        >
          <div style={row}>
            <h2 style={{ margin: 0, fontSize: 16 }}>任务记录</h2>
            <select
              aria-label="选择已有任务"
              style={{ ...control, flex: "1 1 240px", width: "auto" }}
              value={selected?.id || ""}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value)
                  void controller.select(event.target.value);
              }}
            >
              <option value="">选择已有任务</option>
              {state.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.cwd} · {statusLabel(task.status)}
                </option>
              ))}
            </select>
          </div>
          {!selected && (
            <p style={note}>
              {state.tasks.length
                ? "选择任务查看记录，或新建任务。"
                : "还没有 Cursor 任务。填写工作区并创建第一个任务。"}
            </p>
          )}
          {selected && (
            <>
              <div style={{ ...note, overflowWrap: "anywhere" }}>
                {selected.cwd} · {selected.model} ·{" "}
                {selected.permissionMode === "readonly"
                  ? "只读"
                  : selected.permissionMode === "workspace-write"
                    ? "工作区写入"
                    : "Shell"}{" "}
                · {statusLabel(selected.status)}
              </div>
              {selected.status === "stored" && (
                <div style={row}>
                  <p style={note}>此任务保存在本机，恢复后可继续对话。</p>
                  <Button
                    disabled={busy}
                    onClick={() => void controller.resume(selected.id)}
                  >
                    {state.action === "resume" ? "正在恢复…" : "恢复任务"}
                  </Button>
                </div>
              )}
              {statusLabel(selected.status) === "不可继续" && (
                <p
                  role="alert"
                  style={{
                    ...note,
                    color: "var(--dsw-alias-state-warn-label)",
                  }}
                >
                  此任务当前无法继续，请查看下方记录并新建任务。
                </p>
              )}
              <div
                role="log"
                aria-label="任务消息与工具记录"
                aria-live="polite"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxHeight: "50vh",
                  overflow: "auto",
                  padding: "4px 0",
                }}
              >
                {selected.messages.length === 0 && (
                  <p style={note}>
                    {selected.status === "idle"
                      ? "任务已准备好，请在下方输入需求。"
                      : selected.status === "running"
                        ? "正在等待 Cursor 输出…"
                        : selected.status === "stored"
                          ? "恢复任务后可继续对话。"
                          : "此任务当前不可继续，请新建任务。"}
                  </p>
                )}
                {selected.messages.map((message) => (
                  <article
                    key={message.id}
                    style={{
                      borderLeft:
                        "2px solid var(--dsw-alias-settings-card-stroke)",
                      paddingLeft: 12,
                      minWidth: 0,
                    }}
                  >
                    {message.role === "tool" || message.role === "thinking" ? (
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 13 }}>
                          {message.role === "thinking"
                            ? "思考过程"
                            : `工具：${message.toolName || "工具调用"}`}{" "}
                          {message.toolStatus === "running"
                            ? "执行中"
                            : message.toolStatus === "completed"
                              ? "已完成"
                              : message.toolStatus === "error"
                                ? "失败"
                                : ""}
                        </summary>
                        <pre
                          style={{
                            margin: "8px 0 0",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            fontFamily: "inherit",
                            fontSize: 13,
                          }}
                        >
                          {message.text}
                        </pre>
                      </details>
                    ) : (
                      <>
                        <strong style={{ fontSize: 13 }}>
                          {message.role === "user" ? "你" : "Cursor"}
                        </strong>
                        <p
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            margin: "6px 0 0",
                            lineHeight: "1.6",
                          }}
                        >
                          {message.text}
                        </p>
                      </>
                    )}
                  </article>
                ))}
              </div>
              <form
                onSubmit={send}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <label>
                  任务需求
                  <textarea
                    style={{
                      ...control,
                      marginTop: 6,
                      minHeight: 96,
                      resize: "vertical",
                    }}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    required
                    disabled={busy || selected.status !== "idle"}
                    placeholder={
                      selected.status === "unavailable"
                        ? "此任务不可继续，请新建任务"
                        : selected.status === "stored"
                          ? "先恢复任务，再继续对话"
                          : "描述希望完成的任务…"
                    }
                  />
                </label>
                <div style={row}>
                  <Button
                    type="submit"
                    disabled={
                      busy || selected.status !== "idle" || !text.trim()
                    }
                  >
                    {state.action === "send" ? "正在发送…" : "发送"}
                  </Button>
                  {selected.status === "running" && selected.attemptId && (
                    <Button
                      onClick={() =>
                        void controller.cancel(selected.id, selected.attemptId!)
                      }
                    >
                      取消运行
                    </Button>
                  )}
                  <span style={note}>关闭页面不会取消正在运行的任务。</span>
                </div>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export function CursorTasksIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M14 4v5h5M8 13l2 2-2 2m4 0h4" />
    </svg>
  );
}
