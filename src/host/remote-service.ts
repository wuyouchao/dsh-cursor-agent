import { Cursor } from "@cursor/sdk";
import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createAccountController } from "./account-controller.js";
import type { AccountState } from "../shared/account.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    cursorAccount: CursorAccountService;
  }
}

/** 仅暴露安全账号快照，凭据始终由 Cursor SDK 管理。 */
export class CursorAccountService extends TypertRemoteService {
  private readonly controller: ReturnType<typeof createAccountController>;

  constructor(ctx: Context) {
    super(ctx, "cursorAccount");
    this.controller = createAccountController(Cursor);
    ctx.effect(
      () => () => this.controller.dispose(),
      "cursor-account: 结束登录与状态订阅",
    );
  }

  @Remote
  getState(): AccountState {
    return this.controller.getState();
  }

  @Remote
  startLogin(): Promise<AccountState> {
    return this.controller.startLogin();
  }

  @Remote
  cancelLogin(attemptId: string): Promise<AccountState> {
    return this.controller.cancelLogin(attemptId);
  }

  @Remote
  refresh(): Promise<AccountState> {
    return this.controller.refresh();
  }

  @Remote
  logout(): Promise<AccountState> {
    return this.controller.logout();
  }

  @Remote({ mode: "stream" })
  watch(signal: AbortSignal): AsyncIterable<AccountState> {
    return this.controller.watch(signal);
  }
}
