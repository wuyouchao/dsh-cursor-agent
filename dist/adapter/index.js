import { LlmAdapter, ToolCallId } from "@deepseek-ai/dsh-llm";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { modelRoutes, CURSOR_PROVIDER } from "../runtime/catalog.js";
import { serializeTranscript } from "./transcript.js";
import { AdapterEventProjector } from "./events.js";
import { AdapterInputError } from "./errors.js";
const STOPPED = "Cursor请求已停止，工具交由Harness执行";
function safeError(message = "Cursor模型请求失败，请检查账号状态或稍后重试") {
    return new AdapterInputError(message);
}
async function deadline(work, milliseconds) {
    let timer;
    try {
        return await Promise.race([
            work,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(safeError("Cursor未能在期限内确认停止；未向Harness提交工具调用")), milliseconds);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function cancellable(signal, work, late) {
    if (signal.aborted) {
        void work.then((value) => late?.(value)).catch(() => { });
        throw safeError("Cursor请求已取消");
    }
    let aborted = false;
    let listener;
    const stopped = new Promise((_, reject) => {
        listener = () => {
            aborted = true;
            reject(safeError("Cursor请求已取消"));
        };
        signal.addEventListener("abort", listener, { once: true });
    });
    try {
        return await Promise.race([work, stopped]);
    }
    finally {
        signal.removeEventListener("abort", listener);
        if (aborted)
            void work.then((value) => late?.(value)).catch(() => { });
    }
}
function jsonObject(input) {
    try {
        const text = JSON.stringify(input);
        if (text === undefined)
            throw new Error();
        return JSON.parse(text);
    }
    catch {
        throw safeError("Harness工具定义或参数不是有效JSON");
    }
}
/** SDK 仅提出请求；只有 Harness 在审批后执行工具。本 adapter 不持有跨请求 Agent。 */
export class CursorLlmAdapter extends LlmAdapter {
    options;
    activities = new Map();
    disposed = false;
    constructor(options) {
        super();
        this.options = options;
    }
    async dispose() {
        this.disposed = true;
        for (const abort of this.activities.keys())
            abort.abort();
        await Promise.allSettled(this.activities.values());
    }
    providerInfo() {
        return { id: CURSOR_PROVIDER, name: "Cursor" };
    }
    async listModels() {
        return modelRoutes(this.options.getModels()).map(({ selection: _, ...model }) => model);
    }
    async resolveModel(provider, model) {
        const route = modelRoutes(this.options.getModels()).find((entry) => entry.id === model);
        if (provider !== CURSOR_PROVIDER || !route)
            throw safeError("Cursor模型不可用，请登录并刷新模型目录");
        return {
            provider,
            id: route.id,
            name: route.name,
            inputModalities: ["text"],
        };
    }
    async *stream(options) {
        if (this.disposed)
            throw safeError("Cursor模型适配器已卸载");
        const abort = new AbortController();
        const signal = options.signal
            ? AbortSignal.any([options.signal, abort.signal])
            : abort.signal;
        const output = [];
        let wake;
        let done = false;
        let failure;
        const push = (chunks) => {
            if (signal.aborted)
                return;
            output.push(...chunks);
            wake?.();
        };
        const timeout = this.options.toolBoundaryTimeoutMs ?? 5000;
        const worker = (async () => {
            let agent;
            let run;
            let disposal;
            let stopWork;
            let streamIterator;
            let closingStream;
            const consumeAbort = new AbortController();
            let boundarySeen = false;
            let textSeen = false;
            const callbackAbort = new AbortController();
            let markBoundary;
            const boundary = new Promise((resolve) => {
                markBoundary = resolve;
            });
            const calls = [];
            const callIds = new Set();
            const projector = new AdapterEventProjector();
            const disposeAgent = (target) => deadline(Promise.resolve().then(() => target[Symbol.asyncDispose]()), timeout).catch(() => {
                throw safeError("Cursor SDK资源释放失败或超时");
            });
            const dispose = () => (disposal ??= agent ? disposeAgent(agent) : Promise.resolve());
            const closeStream = () => (closingStream ??= (async () => {
                consumeAbort.abort();
                if (streamIterator?.return) {
                    try {
                        await deadline(Promise.resolve().then(() => streamIterator.return()), timeout);
                    }
                    catch {
                        throw safeError("Cursor事件流未能在期限内关闭，未向Harness提交工具调用");
                    }
                }
            })());
            const stop = (target) => {
                if (stopWork)
                    return stopWork;
                // 先发取消，再终止无副作用的挂起回调，避免 SDK 等回调而无法进入终态。
                let cancelling;
                try {
                    cancelling = target.cancel();
                }
                catch {
                    cancelling = Promise.reject(safeError("Cursor取消失败"));
                }
                callbackAbort.abort(safeError(STOPPED));
                stopWork = deadline(Promise.all([cancelling, target.wait()]).then(([, result]) => {
                    if (!["finished", "cancelled", "error"].includes(result.status))
                        throw safeError("Cursor未返回运行终态，未向Harness提交工具调用");
                }), timeout);
                void stopWork.catch(() => { });
                return stopWork;
            };
            try {
                signal.throwIfAborted();
                const route = modelRoutes(this.options.getModels()).find((entry) => entry.id === options.model);
                if (options.provider !== CURSOR_PROVIDER || !route)
                    throw safeError("Cursor模型不可用，请登录并刷新模型目录");
                if (options.maxTokens !== undefined)
                    throw safeError("当前Cursor SDK不支持输出token上限；标题或压缩请使用其他模型");
                if (options.reasoningEffort !== undefined ||
                    options.temperature !== undefined ||
                    options.stop !== undefined)
                    throw safeError("当前Cursor SDK不支持此Harness请求参数，请使用目录中的模型变体");
                const context = await cancellable(signal, this.options.resolveContext(options));
                if (!isAbsolute(context.cwd))
                    throw safeError("Cursor请求缺少可信的绝对工作区路径");
                let transcript;
                try {
                    transcript = serializeTranscript(options);
                }
                catch (error) {
                    if (error instanceof AdapterInputError)
                        throw error;
                    throw safeError("Cursor无法接收未投影的图片、文件、未知内容块或超限会话；未发起模型请求");
                }
                const customTools = {};
                for (const [index, tool] of (options.tools ?? []).entries()) {
                    const key = `harness_tool_${index}`;
                    customTools[key] = {
                        description: `Harness工具 ${tool.name}：${tool.description}。仅提出调用请求，执行与审批由Harness管理。`,
                        inputSchema: jsonObject(tool.parameters),
                        execute(args, context) {
                            if (callbackAbort.signal.aborted || signal.aborted)
                                return Promise.reject(safeError(STOPPED));
                            const id = context.toolCallId ?? randomUUID();
                            if (!callIds.has(id)) {
                                callIds.add(id);
                                calls.push({
                                    id: ToolCallId(id),
                                    name: tool.name,
                                    arguments: JSON.stringify(jsonObject(args)),
                                });
                            }
                            boundarySeen = true;
                            markBoundary();
                            return new Promise((_, reject) => {
                                callbackAbort.signal.addEventListener("abort", () => reject(safeError(STOPPED)), { once: true });
                            });
                        },
                    };
                }
                const sdk = this.options.sdk ?? {
                    create: async (config) => {
                        const { Agent } = await import("@cursor/sdk");
                        return Agent.create(config);
                    },
                };
                agent = await cancellable(signal, sdk.create({
                    model: route.selection,
                    tools: Object.keys(customTools).length ? ["mcp"] : [],
                    disallowedTools: [
                        "shell",
                        "read",
                        "edit",
                        "grep",
                        "glob",
                        "ls",
                        "task",
                        "webSearch",
                        "delete",
                        "readLints",
                        "webFetch",
                        "semSearch",
                        "updateTodos",
                        "readTodos",
                        "askQuestion",
                        "await",
                        "generateImage",
                        "applyAgentDiff",
                    ],
                    mcpServers: {},
                    local: {
                        cwd: context.cwd,
                        settingSources: [],
                        customTools,
                        enableAgentRetries: false,
                        sandboxOptions: { enabled: true },
                    },
                }), disposeAgent);
                const activeAgent = agent;
                run = await cancellable(signal, agent.send(transcript, {
                    model: route.selection,
                    onDelta: ({ update }) => {
                        if (boundarySeen || signal.aborted)
                            return;
                        if (update.type === "text-delta")
                            textSeen = true;
                        push(projector.onDelta(update));
                    },
                }), async (late) => {
                    try {
                        await stop(late);
                    }
                    finally {
                        // send 可能在第一次 dispose 之后才分配 executor lease，迟到运行必须再释放一次。
                        try {
                            await dispose();
                        }
                        finally {
                            await disposeAgent(activeAgent);
                        }
                    }
                });
                const activeRun = run;
                streamIterator = activeRun.stream();
                const consume = (async () => {
                    while (true) {
                        const next = await cancellable(consumeAbort.signal, streamIterator.next());
                        if (next.done)
                            break;
                        const message = next.value;
                        if (boundarySeen || signal.aborted)
                            continue;
                        if (message.type === "request")
                            throw safeError("Cursor请求交互输入，当前补全适配器不支持");
                        if (message.type === "assistant" &&
                            message.message.content.some((block) => block.type === "text" && block.text.length > 0))
                            textSeen = true;
                        push(projector.onMessage(message));
                    }
                    return activeRun.wait();
                })();
                void consume.catch(() => { });
                const outcome = await cancellable(signal, Promise.race([
                    consume.then((result) => ({ kind: "finished", result })),
                    boundary.then(() => ({ kind: "tools" })),
                ]));
                if (outcome.kind === "tools") {
                    await stop(activeRun);
                    await dispose();
                    await closeStream();
                    signal.throwIfAborted();
                    push(projector.appendTools(calls));
                    push(projector.finish({ kind: "tool-calls" }));
                }
                else {
                    if (outcome.result.status !== "finished")
                        throw safeError("Cursor模型运行失败或已取消");
                    if (!textSeen && outcome.result.result)
                        push(projector.onMessage({
                            type: "assistant",
                            agent_id: agent.agentId,
                            run_id: run.id,
                            message: {
                                role: "assistant",
                                content: [{ type: "text", text: outcome.result.result }],
                            },
                        }));
                    await dispose();
                    await closeStream();
                    push(projector.finish({ kind: "stop" }, outcome.result));
                }
            }
            catch (error) {
                if (run) {
                    try {
                        await stop(run);
                    }
                    catch {
                        throw safeError("Cursor未确认停止，未向Harness提交工具调用");
                    }
                }
                throw error instanceof AdapterInputError
                    ? error
                    : safeError("Cursor模型请求未完成，未向Harness提交工具调用");
            }
            finally {
                callbackAbort.abort(safeError(STOPPED));
                try {
                    await dispose();
                }
                finally {
                    await closeStream();
                }
            }
        })()
            .catch((error) => {
            failure = error instanceof Error ? error : safeError();
        })
            .finally(() => {
            done = true;
            this.activities.delete(abort);
            wake?.();
        });
        this.activities.set(abort, worker);
        try {
            while (!done || output.length) {
                if (signal.aborted)
                    throw safeError("Cursor请求已取消");
                if (output.length)
                    yield output.shift();
                else
                    await new Promise((resolve) => {
                        wake = resolve;
                        if (done || output.length)
                            resolve();
                    });
            }
            if (signal.aborted)
                throw safeError("Cursor请求已取消");
            if (failure)
                throw failure;
        }
        finally {
            abort.abort();
            await worker;
            this.activities.delete(abort);
        }
    }
}
//# sourceMappingURL=index.js.map