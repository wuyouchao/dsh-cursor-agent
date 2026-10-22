/** 可取消的外部等待；底层忽略取消时仍观察迟到结果并释放资源。 */
export function raceAbortCall<T>(
  signal: AbortSignal,
  call: () => Promise<T>,
  late?: (value: T) => Promise<unknown>,
): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (!settled) {
        settled = true;
        reject(signal.reason);
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return call();
      })
      .then(
        (value) => {
          signal.removeEventListener("abort", abort);
          if (settled) {
            if (late) void late(value).catch(() => {});
            return;
          }
          settled = true;
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", abort);
          if (!settled) {
            settled = true;
            reject(error);
          }
        },
      );
  });
}
