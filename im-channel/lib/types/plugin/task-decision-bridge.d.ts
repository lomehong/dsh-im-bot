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
import type { ApprovalCardRequest } from '../core/channel.ts';
export type TaskDecision = 'approved' | 'rejected';
export interface TaskCardPayload {
    taskId: string;
    title: string;
    level: string;
    summary: string;
}
export declare class TaskDecisionBridge {
    private readonly sendCard;
    private readonly notify;
    private readonly masterTargets;
    private readonly log;
    private readonly byTask;
    private readonly byToken;
    constructor(sendCard: (kind: string, ownerUserId: string, card: ApprovalCardRequest) => Promise<boolean>, notify: (kind: string, ownerUserId: string, text: string) => Promise<boolean>, masterTargets: () => Array<{
        kind: string;
        userId: string;
    }>, log?: (line: string) => void);
    /** 发起任务决策卡（多渠道同 token，任一点击即决）；返回决策 promise。 */
    request(info: TaskCardPayload): Promise<TaskDecision>;
    /** 卡片按钮点击（approve:/deny: token）；仅 Owner 名单内的点击被接受。 */
    resolveByToken(kind: string, token: string, decision: 'allow' | 'deny', userId: string, settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>): boolean;
    /** 决策已在别处完成（控制台/文本拦截器/主人会话）→ 撤销待决卡。 */
    cancel(taskId: string): boolean;
    private settle;
}
