/** 任务仅存在于独立 Cursor 域，切换页面只停止观察，不取消后台运行。 */
export class CursorTasksStore {
    remote;
    state = { models: [], tasks: [], loading: false };
    listeners = new Set();
    controller;
    generation = 0;
    selection = 0;
    mounted = 0;
    disposed = false;
    constructor(remote) {
        this.remote = remote;
    }
    getSnapshot = () => this.state;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    publish(next) {
        if (this.disposed)
            return;
        this.state = next;
        for (const listener of this.listeners)
            listener();
    }
    accept(task) {
        const previous = this.state.selected;
        if (previous?.id !== task.id || task.revision < previous.revision)
            return;
        this.publish({
            ...this.state,
            selected: task,
            tasks: this.state.tasks.map((item) => item.id === task.id ? task : item),
        });
    }
    observe() {
        this.controller?.abort();
        this.controller = undefined;
        const id = this.state.selected?.id;
        if (!id || !this.mounted || this.disposed)
            return;
        const controller = new AbortController();
        this.controller = controller;
        const generation = this.generation;
        const selection = this.selection;
        void (async () => {
            try {
                for await (const task of this.remote.watch(id, controller.signal)) {
                    if (controller.signal.aborted ||
                        generation !== this.generation ||
                        selection !== this.selection)
                        return;
                    this.accept(task);
                }
                if (!controller.signal.aborted)
                    this.publish({
                        ...this.state,
                        error: "任务状态连接已断开，请刷新任务。",
                    });
            }
            catch {
                if (!controller.signal.aborted)
                    this.publish({
                        ...this.state,
                        error: "无法读取任务动态，请刷新任务。",
                    });
            }
        })();
    }
    mount() {
        if (this.disposed)
            return () => { };
        if (++this.mounted === 1) {
            this.observe();
            void this.refresh();
        }
        let active = true;
        return () => {
            if (!active)
                return;
            active = false;
            if (--this.mounted === 0) {
                this.controller?.abort();
                this.controller = undefined;
            }
        };
    }
    refresh = async () => {
        if (this.disposed || this.state.loading)
            return;
        const generation = this.generation;
        this.publish({ ...this.state, loading: true, error: undefined });
        // 两路独立发布：远端模型目录即使一直等待，本机历史也应立即可读。
        const models = (async () => {
            try {
                const result = await this.remote.listModels();
                if (generation !== this.generation)
                    return;
                this.publish({
                    ...this.state,
                    models: result.ok ? result.value : [],
                    ...(result.ok ? {} : { error: result.error.message }),
                });
            }
            catch {
                if (generation === this.generation)
                    this.publish({
                        ...this.state,
                        models: [],
                        error: "暂时无法读取模型，可继续查看本机任务记录。",
                    });
            }
        })();
        const tasks = (async () => {
            try {
                const result = await this.remote.listTasks();
                if (generation !== this.generation)
                    return;
                if (!result.ok) {
                    this.publish({ ...this.state, error: result.error.message });
                    return;
                }
                this.publish({ ...this.state, tasks: result.value });
                if (this.state.selected) {
                    const selected = this.unwrap(await this.remote.snapshot(this.state.selected.id));
                    if (generation === this.generation)
                        this.accept(selected);
                }
                if (generation === this.generation)
                    this.observe();
            }
            catch {
                if (generation === this.generation)
                    this.publish({
                        ...this.state,
                        error: "暂时无法读取任务列表，请刷新重试。",
                    });
            }
        })();
        await Promise.allSettled([models, tasks]);
        if (generation === this.generation)
            this.publish({ ...this.state, loading: false });
    };
    unwrap(result) {
        if (!result.ok)
            throw new Error(result.error.message);
        return result.value;
    }
    message(error) {
        return error instanceof Error
            ? error.message
            : "无法连接 Cursor 任务服务，请重试。";
    }
    async run(action, operation, select = false) {
        if (this.disposed || this.state.action)
            return;
        const generation = this.generation;
        const selection = select ? ++this.selection : this.selection;
        if (select) {
            this.controller?.abort();
            this.controller = undefined;
        }
        this.publish({ ...this.state, action, error: undefined });
        try {
            const task = this.unwrap(await operation());
            if (generation !== this.generation || selection !== this.selection)
                return;
            if (select) {
                this.publish({
                    ...this.state,
                    selected: task,
                    tasks: [
                        task,
                        ...this.state.tasks.filter((item) => item.id !== task.id),
                    ],
                });
                this.observe();
            }
            else
                this.accept(task);
        }
        catch (error) {
            if (generation === this.generation && selection === this.selection)
                this.publish({ ...this.state, error: this.message(error) });
            if (select &&
                generation === this.generation &&
                selection === this.selection)
                this.observe();
        }
        finally {
            if (generation === this.generation && selection === this.selection)
                this.publish({ ...this.state, action: undefined });
        }
    }
    create = (input) => this.run("create", () => this.remote.create(input), true);
    select = (id) => this.run("select", () => this.remote.snapshot(id), true);
    resume = (id) => this.run("resume", () => this.remote.resume(id), true);
    send = (id, text) => this.run("send", () => this.remote.send(id, text));
    cancel = async (id, attemptId) => {
        const generation = this.generation;
        const selection = this.selection;
        try {
            const task = this.unwrap(await this.remote.cancel(id, attemptId));
            if (generation === this.generation && selection === this.selection)
                this.accept(task);
        }
        catch (error) {
            if (generation === this.generation && selection === this.selection)
                this.publish({ ...this.state, error: this.message(error) });
        }
    };
    reset = () => {
        this.generation++;
        this.selection++;
        this.controller?.abort();
        this.controller = undefined;
        this.publish({ models: [], tasks: [], loading: false });
        if (this.mounted)
            void this.refresh();
    };
    dispose() {
        this.disposed = true;
        this.generation++;
        this.controller?.abort();
        this.listeners.clear();
    }
}
/** 浏览器端先做输入提示；Host 仍独立校验路径并控制权限。 */
export function isAbsoluteWorkspace(value) {
    return /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+|\/)/.test(value.trim());
}
//# sourceMappingURL=tasks-store.js.map