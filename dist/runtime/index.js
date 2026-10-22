var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { watchAccountCatalog, } from "../host/catalog-bridge.js";
import { SessionPreparation, SessionLogOffset, interruptedTurnClosers, } from "@deepseek-ai/dsh-session";
import { createHash } from "node:crypto";
import { raceAbortCall } from "./lifecycle.js";
import { registerRuntimeProjections } from "./projections.js";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { CursorCatalog, CURSOR_PROVIDER } from "./catalog.js";
import { MappingStore, canonicalWorkspace, assertCheckpoint, } from "./storage.js";
import { CursorNativeAgent } from "./agent.js";
export function cursorOptions(mapping, store) {
    const tools = ["read", "grep", "glob", "ls", "readLints", "readTodos"];
    if (mapping.permissionMode !== "readonly")
        tools.push("edit", "delete", "updateTodos");
    if (mapping.permissionMode === "shell")
        tools.push("shell");
    return {
        model: mapping.model,
        tools,
        disallowedTools: [
            "task",
            "mcp",
            "askQuestion",
            "await",
            "generateImage",
            "applyAgentDiff",
        ],
        local: {
            cwd: mapping.workspace,
            store,
            settingSources: [],
            sandboxOptions: { enabled: mapping.sandboxEnabled },
            enableAgentRetries: false,
        },
    };
}
export class CursorFactory {
    ctx;
    config;
    sdk;
    live = new Set();
    pending = new Set();
    abort = new AbortController();
    root;
    mappings;
    catalog;
    constructor(ctx, config, sdk) {
        this.ctx = ctx;
        this.config = config;
        this.sdk = sdk;
        const profile = config.stateDirectory
            ? undefined
            : ctx.get("profileContext");
        this.root = resolve(config.stateDirectory ??
            (profile?.dir
                ? join(profile.dir, "cursor-agent")
                : join(homedir(), ".dsh", "cursor-agent", createHash("sha256")
                    .update(resolve(process.cwd()))
                    .digest("hex")
                    .slice(0, 16))));
        this.mappings = new MappingStore(join(this.root, "mappings"));
        this.catalog = new CursorCatalog(() => sdk.models());
    }
    tracked(job) {
        this.pending.add(job);
        void job.finally(() => this.pending.delete(job)).catch(() => { });
        return job;
    }
    createAgent(owner, options) {
        return this.start(owner, options, (signal) => this.create(owner, { ...options, signal }));
    }
    resume(owner, options) {
        return this.start(owner, options, (signal) => this.restore(owner, { ...options, signal }));
    }
    start(owner, options, call) {
        const abort = new AbortController();
        const signal = AbortSignal.any([
            abort.signal,
            this.abort.signal,
            ...(options.signal ? [options.signal] : []),
        ]);
        owner.effect(() => () => {
            abort.abort(new Error("Cursor Agent 所属作用域已释放"));
        }, "cursor.runtime.pending");
        return this.tracked(raceAbortCall(signal, () => call(signal), (handle) => handle.dispose()));
    }
    validate(options) {
        if (options.provider !== undefined && options.provider !== CURSOR_PROVIDER)
            throw new Error("Cursor 专用模式只接受 cursor 提供方");
        if (options.maxTokens !== undefined ||
            options.reasoningEffort !== undefined)
            throw new Error("请从 Cursor 模型变体目录选择参数；当前SDK不支持Harness独立maxTokens/reasoningEffort");
    }
    async create(owner, options) {
        this.abort.signal.throwIfAborted();
        this.validate(options.agentOptions ?? {});
        if (options.seed?.length || options.parentAgent || options.meta?.isSeeded)
            throw new Error("Cursor 原生模式暂不支持分叉或Harness子Agent");
        const signal = options.signal;
        const workspace = await raceAbortCall(signal, () => canonicalWorkspace(options.meta?.cwd ?? process.cwd()));
        const model = await raceAbortCall(signal, () => this.catalog.select(options.agentOptions?.model));
        const mapping = {
            schemaVersion: 1,
            sdkVersion: "1.0.40",
            sessionId: options.sessionId,
            agentId: "",
            workspace,
            storePath: join(this.root, "sdk"),
            permissionMode: this.config.permissionMode ?? "readonly",
            sandboxEnabled: this.config.sandboxEnabled ?? true,
            model,
        };
        const preparation = SessionPreparation.create(this.ctx.sessions.prepare(options.sessionId, {
            meta: { ...options.meta, cwd: workspace },
        }));
        let handle;
        let sdkAgent;
        let transferred = false;
        try {
            handle = await raceAbortCall(signal, () => this.ctx.sessionPersistence.create(preparation.session.header, {
                inheritedEventCount: preparation.session.inheritedEventCount,
                signal,
            }), (late) => late.close());
            sdkAgent = await raceAbortCall(signal, () => this.sdk.create(cursorOptions(mapping, this.sdk.store(mapping.storePath))), (late) => late[Symbol.asyncDispose]());
            mapping.agentId = sdkAgent.agentId;
            await raceAbortCall(signal, () => this.mappings.put(mapping));
            transferred = true;
            return await this.publish(owner, options.sessionId, options.agentOptions ?? {}, preparation.session, handle, sdkAgent, mapping, options, "startup", 0);
        }
        catch (error) {
            if (!transferred) {
                await sdkAgent?.[Symbol.asyncDispose]().catch(() => { });
                await handle?.close().catch(() => { });
            }
            throw error;
        }
        finally {
            preparation[Symbol.dispose]();
        }
    }
    async restore(owner, options) {
        this.abort.signal.throwIfAborted();
        this.validate(options.agentOptions ?? {});
        if (options.parentAgent)
            throw new Error("Cursor 原生模式暂不支持Harness子Agent");
        const signal = options.signal;
        const mapping = await raceAbortCall(signal, () => this.mappings.get(options.resumeSessionId));
        if (resolve(mapping.storePath) !== join(this.root, "sdk"))
            throw new Error("Cursor store路径与当前配置不一致");
        const store = this.sdk.store(mapping.storePath);
        await raceAbortCall(signal, () => assertCheckpoint(store, mapping));
        if (mapping.permissionMode !== (this.config.permissionMode ?? "readonly") ||
            mapping.sandboxEnabled !== (this.config.sandboxEnabled ?? true))
            throw new Error("恢复配置的工具权限或沙箱策略与原会话不一致");
        if (options.agentOptions?.model && options.agentOptions.model !== "default")
            mapping.model = await raceAbortCall(signal, () => this.catalog.select(options.agentOptions.model));
        const handle = await raceAbortCall(signal, () => this.ctx.sessionPersistence.open(options.resumeSessionId, "write", {
            signal,
        }), (late) => late.close());
        let sdkAgent;
        let transferred = false;
        try {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const read = await raceAbortCall(signal, () => handle.read(0));
                if (!handle.header.cwd ||
                    (await raceAbortCall(signal, () => canonicalWorkspace(handle.header.cwd))) !== mapping.workspace)
                    throw new Error("Harness工作区与Cursor映射不一致");
                const closers = interruptedTurnClosers(read.events);
                if (closers.length)
                    await raceAbortCall(signal, () => handle.append(closers));
                const seed = [...read.events, ...closers];
                const preparation = __addDisposableResource(env_1, SessionPreparation.create(this.ctx.sessions.prepare(options.resumeSessionId, {
                    seed,
                    meta: structuredClone(handle.header),
                    inheritedEventCount: handle.inheritedEventCount,
                    eventState: read.eventState,
                })), false);
                sdkAgent = await raceAbortCall(signal, () => this.sdk.resume(mapping.agentId, cursorOptions(mapping, store)), (late) => late[Symbol.asyncDispose]());
                await raceAbortCall(signal, () => this.mappings.put(mapping));
                transferred = true;
                return await this.publish(owner, options.resumeSessionId, options.agentOptions ?? {}, preparation.session, handle, sdkAgent, mapping, options, "resume", seed.length);
            }
            catch (e_1) {
                env_1.error = e_1;
                env_1.hasError = true;
            }
            finally {
                __disposeResources(env_1);
            }
        }
        catch (error) {
            if (!transferred) {
                await sdkAgent?.[Symbol.asyncDispose]().catch(() => { });
                await handle.close().catch(() => { });
            }
            throw error;
        }
    }
    async publish(owner, id, options, session, handle, sdk, mapping, setup, source, stored) {
        const abort = new AbortController();
        const signal = AbortSignal.any([
            abort.signal,
            this.abort.signal,
            ...(setup.signal ? [setup.signal] : []),
        ]);
        let published = false;
        let detachAgent;
        let detachSession;
        let disposal;
        let persistenceTail = Promise.resolve();
        const flush = () => {
            persistenceTail = persistenceTail.then(async () => {
                if (!published) {
                    const suffix = session.snapshotEvents(SessionLogOffset(stored));
                    if (suffix.length) {
                        await handle.append(suffix);
                        stored += suffix.length;
                    }
                }
                await handle.flush();
            });
            return persistenceTail;
        };
        const agent = new CursorNativeAgent(this.ctx, id, {
            ...options,
            provider: CURSOR_PROVIDER,
            model: !options.model || options.model === "default"
                ? mapping.model.id
                : options.model,
        }, session, sdk, mapping.model, flush);
        const dispose = () => (disposal ??= (async () => {
            abort.abort(new Error("Cursor Agent 生命周期已结束"));
            try {
                try {
                    await agent.close();
                }
                finally {
                    await flush();
                }
            }
            finally {
                try {
                    await agent.scope.dispose();
                }
                finally {
                    try {
                        await handle.close();
                    }
                    finally {
                        detachAgent?.();
                        detachSession?.();
                        this.live.delete(dispose);
                    }
                }
            }
        })());
        this.live.add(dispose);
        owner.effect(() => dispose, `cursor.runtime(${id})`);
        try {
            signal.throwIfAborted();
            owner.fiber.assertActive();
            const commit = await raceAbortCall(signal, async () => setup.setup?.(agent.ctx, agent));
            signal.throwIfAborted();
            owner.fiber.assertActive();
            commit?.commit();
            await raceAbortCall(signal, flush);
            signal.throwIfAborted();
            detachSession = agent.ctx.sessions.enter(session);
            detachAgent = this.ctx.agents.enter(agent, setup.parentAgent);
            published = true;
            agent.ctx.sessions.announce(session);
            await raceAbortCall(signal, () => this.ctx.agents.announce(agent, source, signal));
            signal.throwIfAborted();
            agent.activate();
            return { agent, dispose };
        }
        catch (error) {
            await dispose().catch(() => { });
            throw error;
        }
    }
    async dispose() {
        this.abort.abort(new Error("Cursor 运行时正在卸载"));
        const results = await Promise.allSettled([...this.live].map((dispose) => dispose()));
        await Promise.allSettled(this.pending);
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length)
            throw new AggregateError(failed.map((r) => r.reason), "Cursor运行时释放失败");
    }
}
export async function createRuntimeSdk() {
    const { Agent, Cursor, JsonlLocalAgentStore } = await import("@cursor/sdk");
    return {
        create: async (options) => {
            try {
                return await Agent.create(options);
            }
            catch {
                throw new Error("Cursor Agent 创建失败，请检查登录状态和工作区权限。");
            }
        },
        resume: async (id, options) => {
            try {
                return await Agent.resume(id, options);
            }
            catch {
                throw new Error("Cursor Agent 恢复失败，请检查本地会话与登录状态。");
            }
        },
        models: async () => {
            try {
                return await Cursor.models.list();
            }
            catch {
                throw new Error("Cursor 模型目录读取失败，请检查登录状态后刷新。");
            }
        },
        store: (path) => new JsonlLocalAgentStore(path),
    };
}
export async function applyRuntime(ctx, config = {}, account) {
    const factory = new CursorFactory(ctx, config, await createRuntimeSdk());
    ctx.effect(() => registerRuntimeProjections(ctx), "cursor.projections");
    ctx.effect(() => {
        const registration = ctx.llm.registerAdapter([CURSOR_PROVIDER], factory.catalog);
        const observer = new AbortController();
        const observing = account
            ? watchAccountCatalog(account, () => registration.replace([CURSOR_PROVIDER]), observer.signal).catch(() => {
                if (!observer.signal.aborted)
                    ctx.logger.warn("Cursor 模型目录状态订阅已停止，请重新加载插件。");
            })
            : Promise.resolve();
        return async () => {
            observer.abort();
            await observing;
            registration();
        };
    }, "cursor.catalog");
    ctx.effect(() => ctx.agents.setFactory(factory), "cursor.factory");
    ctx.effect(() => () => factory.dispose(), "cursor.runtime.dispose");
}
//# sourceMappingURL=index.js.map