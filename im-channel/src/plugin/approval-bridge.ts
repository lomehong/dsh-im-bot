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
export type ApprovalDecision = 'allowed-once' | 'rejected'

/** How long an owner has to answer before the request fails closed. */
export const APPROVAL_TIMEOUT_MS = 180_000

/** Reply keywords mapped to decisions (normalized: lowercase, no spaces). */
const ALLOW_WORDS = new Set(['允许', '同意', 'y', 'yes', 'allow', 'approve', '1'])
const DENY_WORDS = new Set(['拒绝', '不同意', 'n', 'no', 'deny', 'reject', '0'])

/** Parse an owner reply into a decision; undefined = not a decision keyword. */
export function parseApprovalReply(text: string): ApprovalDecision | undefined {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, '')
  if (normalized.length === 0 || normalized.length > 12) return undefined
  if (ALLOW_WORDS.has(normalized)) return 'allowed-once'
  if (DENY_WORDS.has(normalized)) return 'rejected'
  return undefined
}

interface PendingApproval {
  toolName: string
  ownerUserId: string
  resolve: (decision: ApprovalDecision) => void
  timer: NodeJS.Timeout
}

/**
 * Per-host coordinator: at most one pending approval per channel kind (the
 * owner answers one question at a time on their phone). The router consults
 * consumeOwnerReply() before normal routing so 允许/拒绝 never reach the
 * agent as chat input.
 */
export class ApprovalBridge {
  private readonly pending = new Map<string, PendingApproval>()

  constructor(
    private readonly notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>,
    private readonly log: (line: string) => void = () => {},
  ) {}

  /** Whether a decision is outstanding for the channel kind. */
  hasPending(kind: string): boolean {
    return this.pending.has(kind)
  }

  /**
   * Ask the channel owner to approve a guest tool call. Resolves with the
   * owner's decision, or 'rejected' on timeout / delivery failure.
   */
  async request(kind: string, ownerUserId: string, guestLabel: string, info: { toolName: string; reason: string | undefined }): Promise<ApprovalDecision> {
    // Serialize per channel: an outstanding question is answered first.
    const existing = this.pending.get(kind)
    if (existing !== undefined) {
      clearTimeout(existing.timer)
      existing.resolve('rejected')
      this.pending.delete(kind)
    }
    const reason = info.reason?.slice(0, 200) ?? ''
    const card = [
      '🔐 访客工具审批',
      `访客：${guestLabel}`,
      `工具：${info.toolName}`,
      ...(reason.length > 0 ? [`说明：${reason}`] : []),
      '',
      `回复「允许」或「拒绝」（${Math.round(APPROVAL_TIMEOUT_MS / 60_000)} 分钟内有效，超时自动拒绝）`,
    ].join('\n')
    return await new Promise<ApprovalDecision>(resolve => {
      let settled = false
      const finish = (decision: ApprovalDecision): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.pending.delete(kind)
        resolve(decision)
      }
      const timer: NodeJS.Timeout = setTimeout(() => {
        this.log(`审批超时未回复（${info.toolName}），自动拒绝`)
        void this.notify(kind, ownerUserId, `⏱ 工具 ${info.toolName} 的审批已超时，自动拒绝。`)
        finish('rejected')
      }, APPROVAL_TIMEOUT_MS)
      timer.unref?.()
      this.pending.set(kind, { toolName: info.toolName, ownerUserId, resolve: finish, timer })
      void this.notify(kind, ownerUserId, card).then(delivered => {
        if (!delivered) {
          this.log(`审批卡片投递失败（${info.toolName}），直接拒绝`)
          finish('rejected')
        }
      })
    })
  }

  /**
   * Router hook: when the channel owner replies while a decision is pending,
   * consume the message as the decision. Returns true when the message was
   * consumed (the router must stop processing it).
   */
  consumeOwnerReply(kind: string, ownerUserId: string, text: string): boolean {
    const pending = this.pending.get(kind)
    if (pending === undefined) return false
    // 纵深防御：即便调用方漏了身份校验，桥本身也只接受该渠道 Owner 的回复。
    if (pending.ownerUserId !== ownerUserId) return false
    const decision = parseApprovalReply(text)
    if (decision === undefined) return false
    this.pending.delete(kind)
    clearTimeout(pending.timer)
    pending.resolve(decision)
    void this.notify(kind, ownerUserId, decision === 'allowed-once' ? `✅ 已允许（本次）工具 ${pending.toolName}` : `🚫 已拒绝工具 ${pending.toolName}`)
    return true
  }
}
