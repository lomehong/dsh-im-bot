/**
 * IM-mediated tool approval bridge (owner-reply style).
 *
 * When a guest-initiated turn hits a tool outside the guestTools allowlist,
 * the driver escalates through the harness `approval/request` waterfall
 * (tools/pre-execute → {kind:'ask'}). This bridge turns that request into an
 * IM card to the channel owner and waits for the owner's REPLY text —
 * 允许/y/allow or 拒绝/n/deny — because Feishu card button callbacks would
 * need a publicly reachable URL that a localhost dsh host cannot offer.
 * Unanswered requests fail closed (rejected) after the timeout.
 */
/** Decision vocabulary the harness approval waterfall expects. */
export type ApprovalDecision = 'allowed-once' | 'rejected';
/** How long an owner has to answer before the request fails closed. */
export declare const APPROVAL_TIMEOUT_MS = 180000;
/** Parse an owner reply into a decision; undefined = not a decision keyword. */
export declare function parseApprovalReply(text: string): ApprovalDecision | undefined;
/**
 * Per-host coordinator: at most one pending approval per channel kind (the
 * owner answers one question at a time on their phone). The router consults
 * consumeOwnerReply() before normal routing so 允许/拒绝 never reach the
 * agent as chat input.
 */
export declare class ApprovalBridge {
    private readonly notify;
    private readonly log;
    private readonly pending;
    constructor(notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>, log?: (line: string) => void);
    /** Whether a decision is outstanding for the channel kind. */
    hasPending(kind: string): boolean;
    /**
     * Ask the channel owner to approve a guest tool call. Resolves with the
     * owner's decision, or 'rejected' on timeout / delivery failure.
     */
    request(kind: string, ownerUserId: string, guestLabel: string, info: {
        toolName: string;
        reason: string | undefined;
    }): Promise<ApprovalDecision>;
    /**
     * Router hook: when the channel owner replies while a decision is pending,
     * consume the message as the decision. Returns true when the message was
     * consumed (the router must stop processing it).
     */
    consumeOwnerReply(kind: string, ownerUserId: string, text: string): boolean;
}
