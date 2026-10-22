/** 可取消的外部等待；底层忽略取消时仍观察迟到结果并释放资源。 */
export declare function raceAbortCall<T>(signal: AbortSignal, call: () => Promise<T>, late?: (value: T) => Promise<unknown>): Promise<T>;
//# sourceMappingURL=lifecycle.d.ts.map