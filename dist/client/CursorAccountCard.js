import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import { copyLoginUrl, safeLoginUrl } from "./browser.js";
export { safeLoginUrl } from "./browser.js";
const card = {
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
const secondary = {
    margin: 0,
    fontSize: 13,
    lineHeight: "20px",
    color: "var(--dsw-alias-label-tertiary)",
};
/** 只通过已脱敏的 Host 状态展示认证和模型目录。 */
export function CursorAccountCard({ controller, }) {
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
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
    return (_jsxs("section", { style: card, "aria-label": "Cursor \u8D26\u53F7", children: [_jsxs("div", { style: {
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                }, children: [_jsx("h3", { style: { margin: 0, fontSize: 15, fontWeight: 500 }, children: "Cursor \u8D26\u53F7" }), _jsx("span", { style: secondary, children: !state
                            ? "正在读取状态…"
                            : state.status === "connected"
                                ? "连接成功"
                                : state.status === "waiting"
                                    ? "等待浏览器授权"
                                    : state.status === "verifying"
                                        ? "正在验证连接…"
                                        : state.status === "error"
                                            ? "连接失败"
                                            : "未登录" })] }), state?.email && (_jsx("p", { style: { margin: 0, overflowWrap: "anywhere" }, children: state.email })), _jsx("p", { style: secondary, children: "\u767B\u5F55\u540E\uFF0C\u5728\u666E\u901A\u804A\u5929\u7684\u6A21\u578B\u83DC\u5355\u4E2D\u9009\u62E9 Cursor \u6A21\u578B\u3002" }), state?.credentialSource === "environment" && (_jsx("p", { style: secondary, children: "\u5F53\u524D\u4F7F\u7528 CURSOR_API_KEY \u73AF\u5883\u53D8\u91CF\uFF0C\u5176\u4F18\u5148\u4E8E\u4FDD\u5B58\u7684\u767B\u5F55\u3002\u9000\u51FA\u4EC5\u6E05\u9664\u4FDD\u5B58\u7684\u767B\u5F55\uFF0C\u73AF\u5883\u53D8\u91CF\u4ECD\u7136\u6709\u6548\u3002" })), state?.credentialSource === "saved" && (_jsx("p", { style: secondary, children: "\u9000\u51FA\u4F1A\u6E05\u9664\u6B64\u8BBE\u5907\u4FDD\u5B58\u7684\u767B\u5F55\u3002" })), state?.status === "waiting" && (_jsx("p", { style: secondary, children: "\u8BF7\u5728\u6D4F\u89C8\u5668\u5B8C\u6210\u6388\u6743\u3002\u5173\u95ED\u6B64\u9875\u9762\u4F1A\u505C\u6B62\u72B6\u6001\u89C2\u5BDF\uFF0C\u767B\u5F55\u4ECD\u53EF\u7EE7\u7EED\u3002" })), state?.status === "verifying" && (_jsx("p", { style: secondary, children: "\u6B63\u5728\u6838\u5BF9\u8D26\u53F7\u4E0E\u6A21\u578B\u76EE\u5F55\uFF0C\u8BF7\u7A0D\u5019\u3002" })), error && (_jsx("p", { role: "alert", style: { ...secondary, color: "var(--dsw-alias-state-warn-label)" }, children: error })), _jsxs("div", { style: {
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                }, children: [!waiting && state?.status !== "connected" && (_jsx(Button, { disabled: snapshot.busy || !state, onClick: () => void controller.login(), children: "\u767B\u5F55 Cursor" })), waiting && url && (_jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", children: "\u6253\u5F00\u6D4F\u89C8\u5668" })), waiting && url && (_jsx(Button, { disabled: snapshot.busy, onClick: () => {
                            void copyLoginUrl(url).then(setCopyStatus);
                        }, children: "\u590D\u5236\u94FE\u63A5" })), waiting && state.attemptId && (_jsx(Button, { disabled: snapshot.busy, onClick: () => void controller.cancel(state.attemptId), children: "\u53D6\u6D88\u767B\u5F55" })), !waiting && (_jsx(Button, { disabled: snapshot.busy, onClick: () => void controller.refresh(), children: snapshot.busy ? "处理中…" : "刷新状态" })), state && !waiting && state.credentialSource !== "none" && (_jsx(Button, { disabled: snapshot.busy, onClick: () => void controller.logout(), children: "\u9000\u51FA\u767B\u5F55" })), _jsx("span", { role: "status", style: secondary, children: copyStatus })] }), state?.status === "connected" && (_jsxs(_Fragment, { children: [_jsxs("p", { style: secondary, children: ["\u767B\u5F55\u9A8C\u8BC1\u901A\u8FC7\uFF0C\u5DF2\u8BFB\u53D6 ", state.models.length, " \u4E2A Cursor \u6A21\u578B\u3002"] }), state.models.length > 0 && (_jsxs("details", { children: [_jsx("summary", { children: "\u67E5\u770B\u6A21\u578B\u76EE\u5F55" }), _jsx("ul", { style: {
                                    margin: "8px 0 0",
                                    paddingLeft: 20,
                                    maxHeight: 240,
                                    overflow: "auto",
                                }, children: state.models.map((model) => (_jsxs("li", { style: { overflowWrap: "anywhere" }, children: [model.displayName, " ", _jsxs("span", { style: secondary, children: ["\uFF08", model.id, "\uFF09"] })] }, model.id))) })] }))] }))] }));
}
//# sourceMappingURL=CursorAccountCard.js.map