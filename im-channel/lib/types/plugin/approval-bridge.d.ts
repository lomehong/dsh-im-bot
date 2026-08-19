/**
 * IM-mediated tool approval bridge (button cards first, text-reply fallback).
 *
 * When a guest-initiated turn hits a tool outside the guestTools allowlist,
 * the driver escalates through the harness `approval/request` waterfall.
 * This bridge asks the channel for a BUTTON approval card (Feishu
 * card.action.trigger and WeCom template_card_event both deliver clicks over
 * the existing long connection — no public callback URL needed). Channels
 * without card support (WeChat iLink) — or failed card sends — fall back to
 * a text card where the owner replies 允许/拒绝. Both paths race; the first
 * decision wins. Unanswered requests fail closed (rejected) on timeout.
 */
/** Decision vocabulary the harness approval waterfall expects. */
export type ApprovalDecision = 'allowed-once' | 'rejected';
/** How long an owner has to answer before the request fails closed. */
export declare const APPROVAL_TIMEOUT_MS = 180000;
/** Parse an owner reply into a decision; undefined = not a decision keyword. */
export declare function parseApprovalReply(text: string): ApprovalDecision | undefined;
/** Random click-linking token for approval cards (same alphabet as spills). */
export declare function newApprovalToken(): string;
/** Card payload the channel layer renders into platform-specific buttons. */
export interface ApprovalCardPayload {
    token: string;
    guestLabel: string;
    toolName: string;
    reason: string | undefined;
}
/**
 * Per-host coordinator: at most one pending approval per channel kind. The
 * router consults consumeOwnerReply() before normal routing so 允许/拒绝
 * never reach the agent as chat input; button clicks arrive through
 * resolveByToken() from the channel's card-callback path.
 */
export declare class ApprovalBridge {
    private readonly notify;
    private readonly sendCard;
    private readonly log;
    private readonly pending;
    private readonly byToken;
    constructor(notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>, sendCard?: (kind: string, ownerUserId: string, card: ApprovalCardPayload) => Promise<boolean>, log?: (line: string) => void);
    /** Whether a decision is outstanding for the channel kind. */
    hasPending(kind: string): boolean;
    private drop;
    /**
     * Ask the channel owner to approve a guest tool call. Sends a button card
     * when the channel supports it (token-linked), otherwise a text card.
     * Resolves with the owner's decision, or 'rejected' on timeout / delivery
     * failure. The text-reply path stays armed either way as a fallback.
     */
    request(kind: string, ownerUserId: string, guestLabel: string, info: {
        toolName: string;
        reason: string | undefined;
    }): Promise<ApprovalDecision>;
    /**
     * Button decision from a channel's card-callback path. Returns true when
     * the click was consumed as the decision for a live, owner-clicked card.
     */
    resolveByToken(kind: string, token: string, decision: 'allow' | 'deny', userId: string, settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>): boolean;
    /**
     * Router hook: when the channel owner replies while a decision is pending,
     * consume the message as the decision. Returns true when the message was
     * consumed (the router must stop processing it).
     */
    consumeOwnerReply(kind: string, ownerUserId: string, text: string): boolean;
}
