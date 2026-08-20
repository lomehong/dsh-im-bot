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

/** 已处理审批的回复路由记忆：重复回复「允许/拒绝」时给出明确回执而非石沉大海。 */
const RESOLVED_ROUTE_TTL_MS = 5 * 60_000
const RESOLVED_ROUTE_LIMIT = 64

/** Random click-linking token for approval cards (same alphabet as spills). */
export function newApprovalToken(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

interface PendingApproval {
  kind: string
  ownerUserId: string
  toolName: string
  resolve: (decision: ApprovalDecision) => void
  timer: NodeJS.Timeout
  /** Card finalizer delivered by the winning click action, if any. */
  settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>
}

/** Card payload the channel layer renders into platform-specific buttons. */
export interface ApprovalCardPayload {
  token: string
  guestLabel: string
  toolName: string
  reason: string | undefined
}

/**
 * Per-host coordinator: at most one pending approval per channel kind. The
 * router consults consumeOwnerReply() before normal routing so 允许/拒绝
 * never reach the agent as chat input; button clicks arrive through
 * resolveByToken() from the channel's card-callback path.
 */
export class ApprovalBridge {
  private readonly pending = new Map<string, PendingApproval>()
  private readonly byToken = new Map<string, PendingApproval>()
  private readonly resolvedRoutes = new Map<string, number>()

  constructor(
    private readonly notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>,
    private readonly sendCard: (kind: string, ownerUserId: string, card: ApprovalCardPayload) => Promise<boolean> = () => Promise.resolve(false),
    private readonly log: (line: string) => void = () => {},
  ) {}

  /** Whether a decision is outstanding for the channel kind. */
  hasPending(kind: string): boolean {
    return this.pending.has(kind)
  }

  private drop(pending: PendingApproval): void {
    if (this.pending.get(pending.kind) === pending) this.pending.delete(pending.kind)
    for (const [token, entry] of this.byToken) {
      if (entry === pending) this.byToken.delete(token)
    }
    // 记录已处理路由（限容量，最旧的先淘汰）。
    const key = `${pending.kind}:${pending.ownerUserId}`
    this.resolvedRoutes.set(key, Date.now())
    if (this.resolvedRoutes.size > RESOLVED_ROUTE_LIMIT) {
      const oldest = this.resolvedRoutes.keys().next().value
      if (oldest !== undefined) this.resolvedRoutes.delete(oldest)
    }
  }

  private resolvedRecently(kind: string, ownerUserId: string): boolean {
    const at = this.resolvedRoutes.get(`${kind}:${ownerUserId}`)
    return at !== undefined && Date.now() - at < RESOLVED_ROUTE_TTL_MS
  }

  /**
   * Ask the channel owner to approve a guest tool call. Sends a button card
   * when the channel supports it (token-linked), otherwise a text card.
   * Resolves with the owner's decision, or 'rejected' on timeout / delivery
   * failure. The text-reply path stays armed either way as a fallback.
   */
  async request(kind: string, ownerUserId: string, guestLabel: string, info: { toolName: string; reason: string | undefined }): Promise<ApprovalDecision> {
    // Serialize per channel: an outstanding question is answered first.
    const existing = this.pending.get(kind)
    if (existing !== undefined) {
      void existing.settleCard?.('timeout').catch(() => {})
      clearTimeout(existing.timer)
      existing.resolve('rejected')
      this.drop(existing)
    }
    return await new Promise<ApprovalDecision>(resolve => {
      let settled = false
      const finish = (decision: ApprovalDecision): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.drop(pending)
        resolve(decision)
      }
      const pending: PendingApproval = {
        kind,
        ownerUserId,
        toolName: info.toolName,
        resolve: finish,
        timer: undefined as unknown as NodeJS.Timeout,
      }
      const timer: NodeJS.Timeout = setTimeout(() => {
        this.log(`审批超时未回复（${info.toolName}），自动拒绝`)
        void pending.settleCard?.('timeout').catch(() => {})
        void this.notify(kind, ownerUserId, `⏱ 工具 ${info.toolName} 的审批已超时，自动拒绝。`)
        finish('rejected')
      }, APPROVAL_TIMEOUT_MS)
      timer.unref?.()
      pending.timer = timer
      this.pending.set(kind, pending)
      const token = newApprovalToken()
      void this.sendCard(kind, ownerUserId, { token, guestLabel, toolName: info.toolName, reason: info.reason }).then(cardSent => {
        if (cardSent) {
          this.byToken.set(token, pending)
          return
        }
        // 文本兜底卡片：Owner 直接回复 允许/拒绝。
        const reason = info.reason?.slice(0, 200) ?? ''
        const card = [
          '🔐 访客工具审批',
          `访客：${guestLabel}`,
          `工具：${info.toolName}`,
          ...(reason.length > 0 ? [`说明：${reason}`] : []),
          '',
          `回复「允许」或「拒绝」（${Math.round(APPROVAL_TIMEOUT_MS / 60_000)} 分钟内有效，超时自动拒绝）`,
        ].join('\n')
        void this.notify(kind, ownerUserId, card).then(delivered => {
          if (!delivered) {
            this.log(`审批卡片投递失败（${info.toolName}），直接拒绝`)
            finish('rejected')
          }
        })
      })
    })
  }

  /**
   * Button decision from a channel's card-callback path. Returns true when
   * the click was consumed as the decision for a live, owner-clicked card.
   */
  resolveByToken(kind: string, token: string, decision: 'allow' | 'deny', userId: string, settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>): boolean {
    const pending = this.byToken.get(token)
    if (pending === undefined || pending.kind !== kind) return false
    // 纵深防御：只接受该渠道 Owner 的点击。
    if (pending.ownerUserId !== userId) {
      this.log(`审批按钮被非 Owner 点击（${userId.slice(0, 8)}…），忽略`)
      return false
    }
    if (settleCard !== undefined) pending.settleCard = settleCard
    const outcome: ApprovalDecision = decision === 'allow' ? 'allowed-once' : 'rejected'
    void pending.settleCard?.(outcome === 'allowed-once' ? 'allowed' : 'rejected').catch(() => {})
    this.drop(pending)
    pending.resolve(outcome)
    return true
  }

  /**
   * Router hook: when the channel owner replies while a decision is pending,
   * consume the message as the decision. Returns true when the message was
   * consumed (the router must stop processing it).
   */
  consumeOwnerReply(kind: string, ownerUserId: string, text: string): boolean {
    const pending = this.pending.get(kind)
    const decision = parseApprovalReply(text)
    if (pending === undefined) {
      // 5 分钟内处理过审批的 Owner 再次回复决策词：给出明确回执，不再流入对话。
      if (decision !== undefined && this.resolvedRecently(kind, ownerUserId)) {
        void this.notify(kind, ownerUserId, '该审批已处理，无需再次回复。')
        return true
      }
      return false
    }
    // 纵深防御：即便调用方漏了身份校验，桥本身也只接受该渠道 Owner 的回复。
    if (pending.ownerUserId !== ownerUserId) return false
    if (decision === undefined) return false
    void pending.settleCard?.(decision === 'allowed-once' ? 'allowed' : 'rejected').catch(() => {})
    this.drop(pending)
    clearTimeout(pending.timer)
    pending.resolve(decision)
    void this.notify(kind, ownerUserId, decision === 'allowed-once' ? `✅ 已允许（本次）工具 ${pending.toolName}` : `🚫 已拒绝工具 ${pending.toolName}`)
    return true
  }
}
