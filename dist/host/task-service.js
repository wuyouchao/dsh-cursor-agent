var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, RemoteError, TypertRemoteService, } from "@deepseek-ai/dsh-typert-protocol";
import { isAbsolute } from "node:path";
function valid(value, maximum = 512) {
    return (typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximum &&
        !value.includes("\0"));
}
function summary(value) {
    return {
        id: value.id,
        cwd: value.cwd,
        revision: value.revision,
        model: value.model,
        status: value.status,
        permissionMode: value.permissionMode,
        sandboxEnabled: value.sandboxEnabled,
        ...(value.attemptId === undefined ? {} : { attemptId: value.attemptId }),
    };
}
function message(value) {
    return {
        id: value.id,
        role: value.role,
        text: value.text,
        ...(value.toolName === undefined ? {} : { toolName: value.toolName }),
        ...(value.toolStatus === undefined ? {} : { toolStatus: value.toolStatus }),
    };
}
/** Gateway 出站不保证 strip，因此此处逐字段构造真正送往客户端的值。 */
export function projectTaskState(value) {
    return { ...summary(value), messages: value.messages.map(message) };
}
/** 独立 Cursor 任务域，不注册或覆盖宿主的全局模型、Agent 或会话。 */
let CursorTaskService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _listModels_decorators;
    let _listTasks_decorators;
    let _create_decorators;
    let _resume_decorators;
    let _send_decorators;
    let _cancel_decorators;
    let _snapshot_decorators;
    let _watch_decorators;
    return class CursorTaskService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _listModels_decorators = [Remote];
            _listTasks_decorators = [Remote];
            _create_decorators = [Remote];
            _resume_decorators = [Remote];
            _send_decorators = [Remote];
            _cancel_decorators = [Remote];
            _snapshot_decorators = [Remote];
            _watch_decorators = [Remote({ mode: "stream" })];
            __esDecorate(this, null, _listModels_decorators, { kind: "method", name: "listModels", static: false, private: false, access: { has: obj => "listModels" in obj, get: obj => obj.listModels }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listTasks_decorators, { kind: "method", name: "listTasks", static: false, private: false, access: { has: obj => "listTasks" in obj, get: obj => obj.listTasks }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: obj => "create" in obj, get: obj => obj.create }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _resume_decorators, { kind: "method", name: "resume", static: false, private: false, access: { has: obj => "resume" in obj, get: obj => obj.resume }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _send_decorators, { kind: "method", name: "send", static: false, private: false, access: { has: obj => "send" in obj, get: obj => obj.send }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancel_decorators, { kind: "method", name: "cancel", static: false, private: false, access: { has: obj => "cancel" in obj, get: obj => obj.cancel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _snapshot_decorators, { kind: "method", name: "snapshot", static: false, private: false, access: { has: obj => "snapshot" in obj, get: obj => obj.snapshot }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _watch_decorators, { kind: "method", name: "watch", static: false, private: false, access: { has: obj => "watch" in obj, get: obj => obj.watch }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        runtime = __runInitializers(this, _instanceExtraInitializers);
        pending = 0;
        watchers = 0;
        sending = new Set();
        constructor(ctx, runtime) {
            super(ctx, "cursorTasks");
            this.runtime = runtime;
        }
        async call(operation) {
            if (this.pending >= 64)
                throw new RemoteError("cursor/task-busy", "Cursor 请求过多，请稍后重试。", {});
            this.pending++;
            try {
                return await operation();
            }
            catch {
                throw new RemoteError("cursor/task-failed", "Cursor 任务操作未完成，请检查连接、工作区及任务状态后重试。", {});
            }
            finally {
                this.pending--;
            }
        }
        id(id) {
            if (!valid(id))
                throw new RemoteError("gateway/bad-request", "Cursor 任务标识无效。", {});
        }
        listModels() {
            return this.call(async () => (await this.runtime.listModels()).map((value) => ({
                id: value.id,
                name: value.name,
            })));
        }
        listTasks() {
            return this.call(async () => (await this.runtime.listTasks()).map(summary));
        }
        create(input) {
            if (!input ||
                !valid(input.cwd, 32768) ||
                !isAbsolute(input.cwd) ||
                !valid(input.model, 32768))
                throw new RemoteError("gateway/bad-request", "请填写绝对工作区路径并选择 Cursor 模型。", {});
            return this.call(async () => projectTaskState(await this.runtime.create({ cwd: input.cwd, model: input.model })));
        }
        resume(id) {
            this.id(id);
            return this.call(async () => projectTaskState(await this.runtime.resume(id)));
        }
        send(id, text) {
            this.id(id);
            if (!valid(text, 100_000) || !text.trim())
                throw new RemoteError("gateway/bad-request", "请输入有效消息（最多十万字符）。", {});
            if (this.sending.has(id))
                throw new RemoteError("cursor/task-busy", "该 Cursor 任务仍在发送消息，请等待或取消。", {});
            this.sending.add(id);
            return this.call(async () => projectTaskState(await this.runtime.send(id, text))).finally(() => this.sending.delete(id));
        }
        cancel(id, attemptId) {
            this.id(id);
            if (!valid(attemptId))
                throw new RemoteError("gateway/bad-request", "Cursor 运行标识无效。", {});
            return this.call(async () => projectTaskState(await this.runtime.cancel(id, attemptId)));
        }
        snapshot(id) {
            this.id(id);
            return this.call(async () => projectTaskState(await this.runtime.snapshot(id)));
        }
        async *watch(id, signal) {
            this.id(id);
            if (this.watchers >= 64)
                throw new RemoteError("cursor/task-busy", "Cursor 订阅过多，请关闭部分任务页面。", {});
            this.watchers++;
            try {
                for await (const value of this.runtime.watch(id, signal)) {
                    if (signal.aborted)
                        return;
                    yield projectTaskState(value);
                }
            }
            catch {
                if (!signal.aborted)
                    throw new RemoteError("cursor/task-failed", "Cursor 任务状态订阅中断，请重新打开任务。", {});
            }
            finally {
                this.watchers--;
            }
        }
    };
})();
export { CursorTaskService };
//# sourceMappingURL=task-service.js.map