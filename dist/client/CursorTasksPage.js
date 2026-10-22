import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import { CursorAccountCard } from "./CursorAccountCard.js";
import { isAbsoluteWorkspace } from "./tasks-store.js";
const box = {
    border: "0.5px solid var(--dsw-alias-settings-card-stroke)",
    borderRadius: 12,
    padding: 16,
    background: "var(--dsw-alias-settings-card-fill)",
    minWidth: 0,
};
const control = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--dsw-alias-settings-card-stroke)",
    borderRadius: 8,
    padding: "8px 10px",
    font: "inherit",
    background: "var(--dsw-alias-settings-card-fill)",
    color: "var(--dsw-alias-label-primary)",
};
const note = {
    margin: 0,
    fontSize: 13,
    lineHeight: "20px",
    color: "var(--dsw-alias-label-tertiary)",
};
const row = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
};
const statusLabel = (status) => ({
    running: "运行中",
    stored: "待恢复",
    unavailable: "不可继续",
    idle: "就绪",
})[status] || "状态未知";
export function CursorTasksPage({ controller, account, }) {
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
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
    const create = (event) => {
        event.preventDefault();
        if (!isAbsoluteWorkspace(cwd)) {
            setValidation("请输入工作区的绝对路径，例如 I:\\project 或 /home/user/project。");
            return;
        }
        if (!chosenModel) {
            setValidation("请先登录 Cursor 并选择可用模型。");
            return;
        }
        setValidation("");
        void controller.create({ cwd: cwd.trim(), model: chosenModel });
    };
    const send = (event) => {
        event.preventDefault();
        if (!selected || !text.trim())
            return;
        const prompt = text.trim();
        void controller.send(selected.id, prompt).then(() => {
            if (!controller.getSnapshot().error)
                setText("");
        });
    };
    return (_jsx("div", { style: {
            height: "100%",
            overflow: "auto",
            boxSizing: "border-box",
            padding: "24px clamp(12px, 3vw, 32px)",
            color: "var(--dsw-alias-label-primary)",
        }, children: _jsxs("main", { style: {
                maxWidth: 1000,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minWidth: 0,
            }, children: [_jsxs("header", { children: [_jsx("h1", { style: { fontSize: 22, margin: "0 0 8px" }, children: "Cursor \u4EFB\u52A1" }), _jsx("p", { style: note, children: "\u5728\u6307\u5B9A\u5DE5\u4F5C\u533A\u4F7F\u7528 Cursor \u6267\u884C\u4EFB\u52A1\u3002\u4EFB\u52A1\u8BB0\u5F55\u4E0E\u666E\u901A\u804A\u5929\u5206\u522B\u4FDD\u5B58\u3002" })] }), _jsxs("details", { style: box, children: [_jsx("summary", { style: { cursor: "pointer" }, children: "Cursor \u8D26\u53F7\u4E0E\u767B\u5F55" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(CursorAccountCard, { controller: account }) })] }), (state.error || validation) && (_jsx("p", { role: "alert", style: { ...note, color: "var(--dsw-alias-state-warn-label)" }, children: validation || state.error })), _jsxs("section", { style: box, "aria-label": "\u521B\u5EFA Cursor \u4EFB\u52A1", children: [_jsx("h2", { style: { margin: "0 0 12px", fontSize: 16 }, children: "\u65B0\u5EFA\u4EFB\u52A1" }), _jsxs("form", { onSubmit: create, style: { display: "flex", flexDirection: "column", gap: 12 }, children: [_jsxs("label", { children: ["\u5DE5\u4F5C\u533A\u7EDD\u5BF9\u8DEF\u5F84", _jsx("input", { style: { ...control, marginTop: 6 }, value: cwd, onChange: (event) => setCwd(event.target.value), placeholder: "\u4F8B\u5982 I:\\project \u6216 /home/user/project", required: true, disabled: busy })] }), _jsxs("label", { children: ["\u6A21\u578B", _jsxs("select", { style: { ...control, marginTop: 6 }, value: chosenModel, onChange: (event) => setModel(event.target.value), required: true, disabled: busy || state.models.length === 0, children: [state.models.length === 0 && (_jsx("option", { value: "", children: "\u6682\u65E0\u53EF\u7528\u6A21\u578B\uFF0C\u8BF7\u767B\u5F55\u540E\u5237\u65B0" })), state.models.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }), _jsxs("div", { style: row, children: [_jsx(Button, { type: "submit", disabled: busy || !cwd.trim() || !chosenModel, children: state.action === "create" ? "正在创建…" : "创建任务" }), _jsx(Button, { disabled: state.loading, onClick: () => void controller.refresh(), children: state.loading ? "正在刷新…" : "刷新任务与模型" }), _jsx("span", { style: note, children: "\u9ED8\u8BA4\u53EA\u8BFB\uFF1B\u521B\u5EFA\u540E\u8F93\u5165\u9700\u6C42\u624D\u4F1A\u5F00\u59CB\u8FD0\u884C\u3002" })] })] })] }), _jsxs("section", { style: { ...box, display: "flex", flexDirection: "column", gap: 12 }, "aria-label": "Cursor \u4EFB\u52A1\u8BB0\u5F55", children: [_jsxs("div", { style: row, children: [_jsx("h2", { style: { margin: 0, fontSize: 16 }, children: "\u4EFB\u52A1\u8BB0\u5F55" }), _jsxs("select", { "aria-label": "\u9009\u62E9\u5DF2\u6709\u4EFB\u52A1", style: { ...control, flex: "1 1 240px", width: "auto" }, value: selected?.id || "", disabled: busy, onChange: (event) => {
                                        if (event.target.value)
                                            void controller.select(event.target.value);
                                    }, children: [_jsx("option", { value: "", children: "\u9009\u62E9\u5DF2\u6709\u4EFB\u52A1" }), state.tasks.map((task) => (_jsxs("option", { value: task.id, children: [task.cwd, " \u00B7 ", statusLabel(task.status)] }, task.id)))] })] }), !selected && (_jsx("p", { style: note, children: state.tasks.length
                                ? "选择任务查看记录，或新建任务。"
                                : "还没有 Cursor 任务。填写工作区并创建第一个任务。" })), selected && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { ...note, overflowWrap: "anywhere" }, children: [selected.cwd, " \u00B7 ", selected.model, " \u00B7", " ", selected.permissionMode === "readonly"
                                            ? "只读"
                                            : selected.permissionMode === "workspace-write"
                                                ? "工作区写入"
                                                : "Shell", " ", "\u00B7 ", statusLabel(selected.status)] }), selected.status === "stored" && (_jsxs("div", { style: row, children: [_jsx("p", { style: note, children: "\u6B64\u4EFB\u52A1\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u6062\u590D\u540E\u53EF\u7EE7\u7EED\u5BF9\u8BDD\u3002" }), _jsx(Button, { disabled: busy, onClick: () => void controller.resume(selected.id), children: state.action === "resume" ? "正在恢复…" : "恢复任务" })] })), statusLabel(selected.status) === "不可继续" && (_jsx("p", { role: "alert", style: {
                                        ...note,
                                        color: "var(--dsw-alias-state-warn-label)",
                                    }, children: "\u6B64\u4EFB\u52A1\u5F53\u524D\u65E0\u6CD5\u7EE7\u7EED\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u8BB0\u5F55\u5E76\u65B0\u5EFA\u4EFB\u52A1\u3002" })), _jsxs("div", { role: "log", "aria-label": "\u4EFB\u52A1\u6D88\u606F\u4E0E\u5DE5\u5177\u8BB0\u5F55", "aria-live": "polite", style: {
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                        maxHeight: "50vh",
                                        overflow: "auto",
                                        padding: "4px 0",
                                    }, children: [selected.messages.length === 0 && (_jsx("p", { style: note, children: selected.status === "idle"
                                                ? "任务已准备好，请在下方输入需求。"
                                                : selected.status === "running"
                                                    ? "正在等待 Cursor 输出…"
                                                    : selected.status === "stored"
                                                        ? "恢复任务后可继续对话。"
                                                        : "此任务当前不可继续，请新建任务。" })), selected.messages.map((message) => (_jsx("article", { style: {
                                                borderLeft: "2px solid var(--dsw-alias-settings-card-stroke)",
                                                paddingLeft: 12,
                                                minWidth: 0,
                                            }, children: message.role === "tool" || message.role === "thinking" ? (_jsxs("details", { children: [_jsxs("summary", { style: { cursor: "pointer", fontSize: 13 }, children: [message.role === "thinking"
                                                                ? "思考过程"
                                                                : `工具：${message.toolName || "工具调用"}`, " ", message.toolStatus === "running"
                                                                ? "执行中"
                                                                : message.toolStatus === "completed"
                                                                    ? "已完成"
                                                                    : message.toolStatus === "error"
                                                                        ? "失败"
                                                                        : ""] }), _jsx("pre", { style: {
                                                            margin: "8px 0 0",
                                                            whiteSpace: "pre-wrap",
                                                            overflowWrap: "anywhere",
                                                            fontFamily: "inherit",
                                                            fontSize: 13,
                                                        }, children: message.text })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { style: { fontSize: 13 }, children: message.role === "user" ? "你" : "Cursor" }), _jsx("p", { style: {
                                                            whiteSpace: "pre-wrap",
                                                            overflowWrap: "anywhere",
                                                            margin: "6px 0 0",
                                                            lineHeight: "1.6",
                                                        }, children: message.text })] })) }, message.id)))] }), _jsxs("form", { onSubmit: send, style: { display: "flex", flexDirection: "column", gap: 8 }, children: [_jsxs("label", { children: ["\u4EFB\u52A1\u9700\u6C42", _jsx("textarea", { style: {
                                                        ...control,
                                                        marginTop: 6,
                                                        minHeight: 96,
                                                        resize: "vertical",
                                                    }, value: text, onChange: (event) => setText(event.target.value), required: true, disabled: busy || selected.status !== "idle", placeholder: selected.status === "unavailable"
                                                        ? "此任务不可继续，请新建任务"
                                                        : selected.status === "stored"
                                                            ? "先恢复任务，再继续对话"
                                                            : "描述希望完成的任务…" })] }), _jsxs("div", { style: row, children: [_jsx(Button, { type: "submit", disabled: busy || selected.status !== "idle" || !text.trim(), children: state.action === "send" ? "正在发送…" : "发送" }), selected.status === "running" && selected.attemptId && (_jsx(Button, { onClick: () => void controller.cancel(selected.id, selected.attemptId), children: "\u53D6\u6D88\u8FD0\u884C" })), _jsx("span", { style: note, children: "\u5173\u95ED\u9875\u9762\u4E0D\u4F1A\u53D6\u6D88\u6B63\u5728\u8FD0\u884C\u7684\u4EFB\u52A1\u3002" })] })] })] }))] })] }) }));
}
export function CursorTasksIcon({ size = 20 }) {
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.6", "aria-hidden": "true", children: [_jsx("path", { d: "M5 4h10l4 4v12H5z" }), _jsx("path", { d: "M14 4v5h5M8 13l2 2-2 2m4 0h4" })] }));
}
//# sourceMappingURL=CursorTasksPage.js.map