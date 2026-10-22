import type { Inbox, InboxTarget, AgentEventDispatch } from "@deepseek-ai/dsh-agent";
import type { MessageId, UserMessage } from "@deepseek-ai/dsh-llm";
import type { Session } from "@deepseek-ai/dsh-session";
export declare class CursorInbox implements Inbox {
    private session;
    private dispatch;
    private pending;
    get nextTurn(): readonly UserMessage[];
    get nextStep(): readonly UserMessage[];
    constructor(session: Session, dispatch: AgentEventDispatch);
    clear(): void;
    append(target: InboxTarget, message: UserMessage): void;
    prepend(target: InboxTarget, message: UserMessage): void;
    replace(id: MessageId, message: UserMessage): boolean;
    remove(id: MessageId): boolean;
    splice(target: InboxTarget, start: number, deleteCount: number, inserted: UserMessage[]): UserMessage[];
    claim(turn: number): UserMessage | undefined;
}
//# sourceMappingURL=inbox.d.ts.map