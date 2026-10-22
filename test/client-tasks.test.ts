import assert from "node:assert/strict";
import test from "node:test";
import {
  CursorTasksStore,
  isAbsoluteWorkspace,
} from "../src/client/tasks-store.js";
import type { CursorTasksRemote } from "../src/client/tasks-store.js";
import type { TaskState } from "../src/shared/tasks.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const initial: TaskState = {
    id: "task-a",
    cwd: "I:\\fixture",
    revision: 1,
    model: "fixture",
    status: "idle",
    permissionMode: "readonly",
    sandboxEnabled: true,
    messages: [],
  };
  const records = new Map([[initial.id, initial]]);
  const calls: string[] = [];
  const watchers = new Map<
    string,
    Set<(state: TaskState | undefined) => void>
  >();
  let modelsOffline = false;
  let modelsHanging = false;
  let cancelled: [string, string] | undefined;
  let pendingSend:
    ((value: { ok: true; value: TaskState }) => void) | undefined;
  let signal: AbortSignal | undefined;
  const remote: CursorTasksRemote = {
    listModels: async () => {
      calls.push("listModels");
      if (modelsOffline) throw new Error("fixture offline");
      if (modelsHanging) return new Promise(() => {});
      return { ok: true, value: [{ id: "fixture", name: "示例模型" }] };
    },
    listTasks: async () => {
      calls.push("listTasks");
      return { ok: true, value: [...records.values()] };
    },
    create: async (input) => {
      calls.push("create");
      return {
        ok: true,
        value: { ...initial, cwd: input.cwd, model: input.model },
      };
    },
    resume: async (id) => {
      calls.push("resume");
      return { ok: true, value: { ...records.get(id)!, status: "idle" } };
    },
    snapshot: async (id) => ({ ok: true, value: records.get(id)! }),
    send: () => {
      calls.push("send");
      return new Promise((resolve) => {
        pendingSend = resolve;
      });
    },
    cancel: async (id, attempt) => {
      calls.push("cancel");
      cancelled = [id, attempt];
      return {
        ok: true,
        value: { ...records.get(id)!, status: "idle", revision: 3 },
      };
    },
    watch(id, nextSignal) {
      signal = nextSignal;
      return {
        send() {},
        end() {},
        dispose() {},
        async *[Symbol.asyncIterator]() {
          yield records.get(id)!;
          while (!nextSignal?.aborted) {
            const state = await new Promise<TaskState | undefined>(
              (resolve) => {
                let listeners = watchers.get(id);
                if (!listeners) {
                  listeners = new Set();
                  watchers.set(id, listeners);
                }
                const receive = (state: TaskState | undefined) => {
                  listeners!.delete(receive);
                  nextSignal?.removeEventListener("abort", abort);
                  resolve(state);
                };
                const abort = () => receive(undefined);
                listeners.add(receive);
                nextSignal?.addEventListener("abort", abort, { once: true });
              },
            );
            if (!state) return;
            yield state;
          }
        },
      };
    },
  };
  return {
    store: new CursorTasksStore(remote),
    initial,
    calls,
    offline: () => {
      modelsOffline = true;
    },
    hangModels: () => {
      modelsHanging = true;
    },
    signal: () => signal,
    cancelled: () => cancelled,
    publish(state: TaskState) {
      records.set(state.id, state);
      for (const receive of [...(watchers.get(state.id) ?? [])]) receive(state);
    },
    completeSend(state: TaskState) {
      pendingSend?.({ ok: true, value: state });
    },
  };
}
test("任务页初次加载只读目录，不创建、恢复或发送任务", async () => {
  const f = fixture();
  const close = f.store.mount();
  await tick();
  assert.deepEqual(f.calls, ["listModels", "listTasks"]);
  assert.equal(f.store.getSnapshot().tasks.length, 1);
  close();
});
test("任务流更新消息，离开页面停止观察但不取消后台任务", async () => {
  const f = fixture();
  const close = f.store.mount();
  await tick();
  await f.store.select(f.initial.id);
  await tick();
  f.publish({
    ...f.initial,
    revision: 2,
    status: "running",
    attemptId: "attempt-a",
    messages: [{ id: "a", role: "assistant", text: "正在检查" }],
  });
  await tick();
  assert.equal(f.store.getSnapshot().selected?.messages[0]?.text, "正在检查");
  close();
  assert.equal(f.signal()?.aborted, true);
  assert.equal(f.calls.includes("cancel"), false);
});
test("运行中发送尚未返回也可取消，旧返回不能覆盖新版本", async () => {
  const f = fixture();
  const close = f.store.mount();
  await tick();
  await f.store.select(f.initial.id);
  const pending = f.store.send(f.initial.id, "测试需求");
  f.publish({
    ...f.initial,
    revision: 2,
    status: "running",
    attemptId: "attempt-a",
  });
  await tick();
  await f.store.cancel(f.initial.id, "attempt-a");
  assert.deepEqual(f.cancelled(), ["task-a", "attempt-a"]);
  f.completeSend(f.initial);
  await pending;
  assert.equal(f.store.getSnapshot().selected?.revision, 3);
  assert.equal(f.store.getSnapshot().selected?.status, "idle");
  close();
});
test("重连清除旧代任务，晚到发送结果不恢复旧任务", async () => {
  const f = fixture();
  await f.store.create({ cwd: "I:\\fixture", model: "fixture" });
  const pending = f.store.send(f.initial.id, "测试需求");
  f.store.reset();
  f.completeSend({ ...f.initial, revision: 10 });
  await pending;
  assert.equal(f.store.getSnapshot().selected, undefined);
});
test("工作区需要绝对路径", () => {
  for (const path of [
    "I:\\project",
    "C:/project",
    "/home/user/project",
    "\\\\server\\share\\project",
  ])
    assert.equal(isAbsoluteWorkspace(path), true);
  for (const path of ["", "project", "../project", "C:project"])
    assert.equal(isAbsoluteWorkspace(path), false);
});
test("模型离线仍显示本机历史，创建模型保持不可用", async () => {
  const f = fixture();
  f.offline();
  await f.store.refresh();
  assert.equal(f.store.getSnapshot().tasks.length, 1);
  assert.deepEqual(f.store.getSnapshot().models, []);
  assert.match(f.store.getSnapshot().error!, /可继续查看本机任务记录/);
});
test("模型请求永不结算时本机列表先显示，仍可选择历史", async () => {
  const f = fixture();
  f.hangModels();
  const close = f.store.mount();
  await tick();
  assert.equal(f.store.getSnapshot().tasks.length, 1);
  assert.equal(f.store.getSnapshot().loading, true);
  await f.store.select(f.initial.id);
  assert.equal(f.store.getSnapshot().selected?.id, f.initial.id);
  close();
});
