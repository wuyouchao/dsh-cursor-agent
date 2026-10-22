import contribution from "../remote.js";
import { CursorAccountCard } from "./CursorAccountCard.js";
import { CursorAccountStore } from "./store.js";
import { CursorTasksPage, CursorTasksIcon } from "./CursorTasksPage.js";
import { CursorTasksStore } from "./tasks-store.js";
export const inject = ["slots", "remote"];
export async function apply(ctx) {
    await ctx.remote.$mount(contribution);
    ctx.plugin({
        inject: ["slots", "remote", "remote.cursorAccount"],
        apply: applyAccount,
    });
}
function applyAccount(ctx) {
    const controller = new CursorAccountStore(ctx.remote.cursorAccount);
    ctx.on("connection/reset", controller.reset);
    ctx.effect(() => () => controller.dispose(), "cursor-account: 页面状态生命周期");
    // 独立入口不经过 Models 页的数据加载门控；两个入口共用同一安全快照。
    ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "cursor",
        order: 15,
        label: "Cursor",
        inject: () => ({ controller }),
    }, CursorAccountCard));
    ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
        name: "settings.models.footer",
        id: "cursor-account",
        order: 100,
        inject: () => ({ controller }),
    }, CursorAccountCard));
    ctx.plugin({
        inject: ["slots", "remote", "remote.cursorTasks"],
        apply(taskCtx) {
            const tasks = new CursorTasksStore(taskCtx.remote.cursorTasks);
            taskCtx.on("connection/reset", tasks.reset);
            taskCtx.effect(() => () => tasks.dispose(), "cursor-tasks: 页面状态生命周期");
            const panel = "cursor-tasks";
            taskCtx.slots.inject("main", () => taskCtx.slots.register({
                name: "main",
                key: panel,
                inject: () => ({ controller: tasks, account: controller }),
            }, CursorTasksPage));
            taskCtx.slots.inject("sidebar.panellist", () => taskCtx.slots.register({
                name: "sidebar.panellist",
                id: panel,
                order: 20,
                label: "Cursor 任务",
            }, CursorTasksIcon));
        },
    });
}
//# sourceMappingURL=index.js.map