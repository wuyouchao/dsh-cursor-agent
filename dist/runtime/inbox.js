export class CursorInbox {
    session;
    dispatch;
    pending = [];
    get nextTurn() {
        return this.pending;
    }
    get nextStep() {
        return [];
    }
    constructor(session, dispatch) {
        this.session = session;
        this.dispatch = dispatch;
        for (const event of session.snapshotEvents()) {
            if (event.type === "agent/inbox/spliced") {
                if (event.data.target === "next-step" && event.data.inserted.length)
                    throw new Error("无法恢复包含不受支持 steering 的会话");
                if (event.data.target === "next-turn")
                    this.pending.splice(event.data.start, event.data.removedCount ?? 0, ...event.data.inserted);
            }
        }
    }
    clear() {
        this.splice("next-turn", 0, this.pending.length, []);
    }
    append(target, message) {
        this.splice(target, this.pending.length, 0, [message]);
    }
    prepend(target, message) {
        this.splice(target, 0, 0, [message]);
    }
    replace(id, message) {
        const i = this.pending.findIndex((m) => m.id === id);
        if (i < 0)
            return false;
        this.splice("next-turn", i, 1, [message]);
        return true;
    }
    remove(id) {
        const i = this.pending.findIndex((m) => m.id === id);
        if (i < 0)
            return false;
        this.splice("next-turn", i, 1, []);
        return true;
    }
    splice(target, start, deleteCount, inserted) {
        if (target !== "next-turn")
            throw new Error("Cursor 原生模式暂不支持 next-step/steer/inject");
        const candidate = this.pending.toSpliced(start, deleteCount, ...inserted);
        if (new Set(candidate.map((m) => m.id)).size !== candidate.length)
            throw new Error("重复的待处理消息标识");
        const normalized = start < 0
            ? Math.max(this.pending.length + Math.trunc(start), 0)
            : Math.min(Math.trunc(start), this.pending.length);
        const count = Math.min(Math.max(Math.trunc(deleteCount), 0), this.pending.length - normalized);
        const removed = this.pending.slice(normalized, normalized + count);
        if (!removed.length && !inserted.length)
            return [];
        this.session.append("agent/inbox/spliced", {
            target,
            start: normalized,
            removedCount: count,
            inserted,
        });
        this.pending = structuredClone(candidate);
        for (const message of inserted)
            this.dispatch.emit("agent/inbox/inserted", { message });
        for (const message of removed)
            this.dispatch.emit("agent/inbox/discarded", { message });
        return removed;
    }
    claim(turn) {
        const message = this.pending[0];
        if (!message)
            return undefined;
        this.session.append("agent/inbox/spliced", {
            target: "next-turn",
            start: 0,
            removedCount: 1,
            inserted: [],
        });
        this.pending = this.pending.slice(1);
        this.dispatch.emit("agent/inbox/claimed", { message, turn });
        return message;
    }
}
//# sourceMappingURL=inbox.js.map