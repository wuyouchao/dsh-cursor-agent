import type { RuntimeConfig, RuntimeSdk } from "./index.js";
import type { StandaloneRuntime } from "../shared/tasks.js";
/** 原生任务拥有独立事件域，宿主官方 Agent/LLM/预设均不可见其中的会话。 */
export declare function createStandaloneRuntime(config: RuntimeConfig & {
    stateDirectory: string;
}, injectedSdk?: RuntimeSdk): Promise<StandaloneRuntime>;
//# sourceMappingURL=standalone.d.ts.map