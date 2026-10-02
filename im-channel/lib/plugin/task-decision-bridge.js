import { newApprovalToken } from "./approval-bridge.js";
const MAX_PENDING = 32;
export class TaskDecisionBridge {
    sendCard;
    notify;
    masterTargets;
    log;
    byTask = new Map();
    byToken = new Map();
    constructor(sendCard, notify, masterTargets, log = () => { }) {
        this.sendCard = sendCard;
        this.notify = notify;
        this.masterTargets = masterTargets;
        this.log = log;
    }
    /** 发起任务决策卡（多渠道同 token，任一点击即决）；返回决策 promise。 */
    async request(info) {
        const existing = this.byTask.get(info.taskId);
        if (existing !== undefined)
            return existing.promise;
        // 内存上限保护：溢出时丢弃最旧（其 promise 不再 resolve，调用方 fire-and-forget 可容忍）
        while (this.byTask.size >= MAX_PENDING) {
            const oldest = this.byTask.keys().next().value;
            if (oldest === undefined)
                break;
            this.cancel(oldest);
        }
        const token = newApprovalToken();
        let resolveFn;
        const promise = new Promise(resolve => { resolveFn = resolve; });
        const targets = this.masterTargets();
        const pending = { taskId: info.taskId, token, ownerUserIds: targets.map(t => t.userId), resolve: resolveFn, promise };
        this.byTask.set(info.taskId, pending);
        this.byToken.set(token, pending);
        for (const t of targets) {
            try {
                const ok = await this.sendCard(t.kind, t.userId, { token, guestLabel: '', toolName: '', reason: undefined, task: info });
                if (!ok) {
                    await this.notify(t.kind, t.userId, `🔐 任务审批 ${info.taskId}（${info.level}）\n标题：${info.title}\n回复「同意 ${info.taskId}」批准，「拒绝 ${info.taskId}」驳回`);
                }
            }
            catch (error) {
                this.log(`任务决策卡发送失败（${t.kind}）: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        this.log(`任务决策卡已发起: ${info.taskId} token=${token} targets=${targets.length}`);
        return promise;
    }
    /** 卡片按钮点击（approve:/deny: token）；仅 Owner 名单内的点击被接受。 */
    resolveByToken(kind, token, decision, userId, settleCard) {
        const pending = this.byToken.get(token);
        if (pending === undefined)
            return false;
        if (!pending.ownerUserIds.includes(userId)) {
            this.log(`任务决策卡点击者非 Owner 名单（${userId.slice(0, 12)}…），拒绝`);
            return false;
        }
        this.settle(pending, decision === 'allow' ? 'approved' : 'rejected');
        void settleCard?.(decision === 'allow' ? 'allowed' : 'rejected').catch(() => { });
        void this.notify(kind, userId, decision === 'allow' ? `✅ 已批准 ${pending.taskId}（IM 卡片）` : `🚫 已驳回 ${pending.taskId}（IM 卡片）`);
        return true;
    }
    /** 决策已在别处完成（控制台/文本拦截器/主人会话）→ 撤销待决卡。 */
    cancel(taskId) {
        const pending = this.byTask.get(taskId);
        if (pending === undefined)
            return false;
        this.byTask.delete(taskId);
        this.byToken.delete(pending.token);
        return true;
    }
    settle(pending, decision) {
        this.byTask.delete(pending.taskId);
        this.byToken.delete(pending.token);
        pending.resolve(decision);
    }
}
