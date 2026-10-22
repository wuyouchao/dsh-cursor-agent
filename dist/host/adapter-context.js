import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { AdapterInputError } from "../adapter/errors.js";
/** 只从宿主正在管理的会话读取当前目录，不接受模型或客户端传入路径。 */
export async function resolveAdapterContext(ctx, options) {
    options.signal?.throwIfAborted();
    if (!options.sessionId)
        throw new AdapterInputError("Cursor 请求缺少宿主会话标识。");
    const agent = ctx.agents.get(options.sessionId);
    if (!agent)
        throw new AdapterInputError("Cursor 请求对应的宿主会话已关闭。");
    const directory = ctx.workingDirectory.get(agent.session);
    if (!isAbsolute(directory))
        throw new AdapterInputError("宿主会话的工作目录必须为绝对路径。");
    let cwd;
    try {
        cwd = await realpath(directory);
        if (!(await stat(cwd)).isDirectory())
            throw new Error();
    }
    catch {
        throw new AdapterInputError("宿主会话的工作目录已不可用，请重新选择工作区。");
    }
    options.signal?.throwIfAborted();
    if (ctx.agents.get(options.sessionId) !== agent)
        throw new AdapterInputError("Cursor 请求对应的宿主会话已关闭。");
    return { cwd };
}
//# sourceMappingURL=adapter-context.js.map