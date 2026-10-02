/**
 * P1.5 任务决策卡桥（task-board 阻断式审批的 IM 侧承接）。
 *
 * 与 approval-bridge（访客工具审批）的差异：
 * - 无超时 fail-closed：任务在看板里保持「待审批」，卡片点了才算，不自动拒绝；
 * - 决策词汇是 批准/拒绝（按钮 key 复用 approve:/deny: 词汇与回传链路）；
 * - 文本兜底走 task-board 的主人回复拦截器（同意/拒绝 TB-x），本桥只管按钮；
 * - 按任务号去重：重复请求（二次推送）复用同一决策 promise。
 * 纵深防御：仅渠道 Owner 本人（masterTargets 名单内）的点击被接受。
 */
import type { ApprovalCardRequest } from '../core/channel.ts'
import { newApprovalToken } from './approval-bridge.ts'

export type TaskDecision = 'approved' | 'rejected'

export interface TaskCardPayload {
  taskId: string
  title: string
  level: string
  summary: string
}

interface PendingTaskDecision {
  taskId: string
  token: string
  ownerUserIds: ReadonlyArray<string>
  resolve: (decision: TaskDecision) => void
  promise: Promise<TaskDecision>
}

const MAX_PENDING = 32

export class TaskDecisionBridge {
  private readonly byTask = new Map<string, PendingTaskDecision>()
  private readonly byToken = new Map<string, PendingTaskDecision>()

  constructor(
    private readonly sendCard: (kind: string, ownerUserId: string, card: ApprovalCardRequest) => Promise<boolean>,
    private readonly notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>,
    private readonly masterTargets: () => Array<{ kind: string; userId: string }>,
    private readonly log: (line: string) => void = () => {},
  ) {}

  /** 发起任务决策卡（多渠道同 token，任一点击即决）；返回决策 promise。 */
  async request(info: TaskCardPayload): Promise<TaskDecision> {
    const existing = this.byTask.get(info.taskId)
    if (existing !== undefined) return existing.promise
    // 内存上限保护：溢出时丢弃最旧（其 promise 不再 resolve，调用方 fire-and-forget 可容忍）
    while (this.byTask.size >= MAX_PENDING) {
      const oldest = this.byTask.keys().next().value
      if (oldest === undefined) break
      this.cancel(oldest)
    }
    const token = newApprovalToken()
    let resolveFn!: (decision: TaskDecision) => void
    const promise = new Promise<TaskDecision>(resolve => { resolveFn = resolve })
    const targets = this.masterTargets()
    const pending: PendingTaskDecision = { taskId: info.taskId, token, ownerUserIds: targets.map(t => t.userId), resolve: resolveFn, promise }
    this.byTask.set(info.taskId, pending)
    this.byToken.set(token, pending)
    for (const t of targets) {
      try {
        const ok = await this.sendCard(t.kind, t.userId, { token, guestLabel: '', toolName: '', reason: undefined, task: info })
        if (!ok) {
          await this.notify(t.kind, t.userId, `🔐 任务审批 ${info.taskId}（${info.level}）\n标题：${info.title}\n回复「同意 ${info.taskId}」批准，「拒绝 ${info.taskId}」驳回`)
        }
      } catch (error) {
        this.log(`任务决策卡发送失败（${t.kind}）: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.log(`任务决策卡已发起: ${info.taskId} token=${token} targets=${targets.length}`)
    return promise
  }

  /** 卡片按钮点击（approve:/deny: token）；仅 Owner 名单内的点击被接受。 */
  resolveByToken(kind: string, token: string, decision: 'allow' | 'deny', userId: string, settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>): boolean {
    const pending = this.byToken.get(token)
    if (pending === undefined) return false
    if (!pending.ownerUserIds.includes(userId)) {
      this.log(`任务决策卡点击者非 Owner 名单（${userId.slice(0, 12)}…），拒绝`)
      return false
    }
    this.settle(pending, decision === 'allow' ? 'approved' : 'rejected')
    void settleCard?.(decision === 'allow' ? 'allowed' : 'rejected').catch(() => {})
    void this.notify(kind, userId, decision === 'allow' ? `✅ 已批准 ${pending.taskId}（IM 卡片）` : `🚫 已驳回 ${pending.taskId}（IM 卡片）`)
    return true
  }

  /** 决策已在别处完成（控制台/文本拦截器/主人会话）→ 撤销待决卡。 */
  cancel(taskId: string): boolean {
    const pending = this.byTask.get(taskId)
    if (pending === undefined) return false
    this.byTask.delete(taskId)
    this.byToken.delete(pending.token)
    return true
  }

  private settle(pending: PendingTaskDecision, decision: TaskDecision): void {
    this.byTask.delete(pending.taskId)
    this.byToken.delete(pending.token)
    pending.resolve(decision)
  }
}
