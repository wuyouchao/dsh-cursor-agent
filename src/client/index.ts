import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-settings-models/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-connection/client";
import contribution from "../remote.js";
import { CursorAccountCard } from "./CursorAccountCard.js";
import { CursorAccountStore } from "./store.js";

export const inject = ["slots", "remote"];

export async function apply(ctx: Context): Promise<void> {
  await ctx.remote.$mount(contribution);
  ctx.plugin({
    inject: ["slots", "remote", "remote.cursorAccount"],
    apply: applyAccount,
  });
}

function applyAccount(ctx: Context): void {
  const controller = new CursorAccountStore(ctx.remote.cursorAccount);
  ctx.on("connection/reset", controller.reset);
  ctx.effect(
    () => () => controller.dispose(),
    "cursor-account: 页面状态生命周期",
  );
  ctx.slots.inject("settings.models.footer", () =>
    ctx.slots.register(
      {
        name: "settings.models.footer",
        id: "cursor-account",
        order: 100,
        inject: () => ({ controller }),
      },
      CursorAccountCard,
    ),
  );
}
