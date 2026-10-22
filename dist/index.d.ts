import type { Context } from "@deepseek-ai/cordis";
import { z } from "zod";
export declare const name = "dsh-cursor-agent";
export declare const inject: string[];
export declare const Config: z.ZodPrefault<z.ZodObject<{}, z.core.$strip>>;
export type Config = z.infer<typeof Config>;
/** Cursor 作为真正模型适配器加入官方聊天，工具和权限由 Harness 执行。 */
export declare function apply(ctx: Context, _config?: Config): Promise<void>;
export { CursorAccountService } from "./host/remote-service.js";
export type { AccountState, AccountModel } from "./shared/account.js";
declare const _default: {
    name: string;
    inject: string[];
    Config: z.ZodPrefault<z.ZodObject<{}, z.core.$strip>>;
    apply: typeof apply;
};
export default _default;
//# sourceMappingURL=index.d.ts.map