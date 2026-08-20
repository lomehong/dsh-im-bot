/**
 * IM bridge for harness user-questions (`ask_user_question`).
 *
 * The plugin wraps ctx.userQuestions with a routing provider: questions on
 * driver-owned sessions render to the asking user's IM as a numbered option
 * list; any reply that is not a slash command becomes the answer (option
 * numbers, option labels, comma-separated multi-select, or free text).
 * Everything else delegates to the original provider (the web UI).
 * Rendering and answer mapping follow xmanrui/dsh-im's harness-question.mjs.
 */
/** How long the user has to answer before the ask rejects. */
export const QUESTION_TIMEOUT_MS = 10 * 60_000;
/** Map one reply token to an option label; numbers index the option list. */
function optionLabel(token, options) {
    const normalized = token.trim();
    if (normalized.length === 0)
        return null;
    if (/^\d+$/.test(normalized)) {
        const option = options[Number(normalized) - 1];
        return option === undefined ? null : option.label;
    }
    const exact = options.find(option => option.label === normalized);
    return exact === undefined ? null : exact.label;
}
/** Parse a reply into the structured answer for one question. */
export function answerForQuestion(question, text) {
    const options = question.options ?? [];
    if (options.length === 0) {
        return { id: question.id, selected: [], custom: text.trim() };
    }
    const tokens = text.trim().split(/[,，、\s]+/).filter(t => t.length > 0);
    const selected = [];
    let unmatched = [];
    for (const token of tokens) {
        const label = optionLabel(token, options);
        if (label !== null) {
            if (!selected.includes(label))
                selected.push(label);
        }
        else {
            unmatched.push(token);
        }
    }
    if (question.multiSelect !== true && selected.length > 1)
        selected.length = 1;
    const custom = unmatched.length > 0 ? unmatched.join(' ') : undefined;
    if (selected.length === 0 && custom === undefined) {
        // 整条回复没有命中任何选项：作为自由文本回答。
        return { id: question.id, selected: [], custom: text.trim() };
    }
    return { id: question.id, selected, ...(custom !== undefined ? { custom } : {}) };
}
/** Render questions as IM text with numbered options (borrowed format). */
export function questionText(questions) {
    const lines = [];
    questions.forEach((question, index) => {
        if (index > 0)
            lines.push('', '──────────');
        const progress = questions.length > 1 ? `（${index + 1}/${questions.length}）` : '';
        lines.push(`❓ 请补充信息${progress}`);
        if (question.header !== undefined && question.header.length > 0)
            lines.push('', question.header);
        lines.push('', question.question);
        if (question.detail !== undefined && question.detail.length > 0)
            lines.push('', question.detail);
        const options = question.options ?? [];
        if (options.length > 0) {
            lines.push('');
            options.forEach((option, optionIndex) => {
                const description = option.description !== undefined && option.description.length > 0 ? ` — ${option.description}` : '';
                lines.push(`${optionIndex + 1}. ${option.label}${description}`);
            });
            lines.push('', question.multiSelect === true
                ? '回复选项序号或文字，多选用逗号分隔；也可直接输入其他内容。'
                : '回复一个选项序号或文字，也可直接输入其他答案。');
        }
        else {
            lines.push('', '请直接回复你的答案。');
        }
    });
    lines.push('', `（${Math.round(QUESTION_TIMEOUT_MS / 60_000)} 分钟内有效；发送 /停止 可放弃本次提问）`);
    return lines.join('\n');
}
/**
 * Per-host coordinator: one outstanding question per channel user (the reply
 * channel is the asking user's chat). The router consults consumeReply()
 * before normal routing so answers never reach the agent as chat input.
 */
export class QuestionBridge {
    notify;
    cancel;
    log;
    pending = new Map();
    constructor(notify, cancel = () => false, log = () => { }) {
        this.notify = notify;
        this.cancel = cancel;
        this.log = log;
    }
    hasPendingFor(kind, userId) {
        return this.pending.has(`${kind}:${userId}`);
    }
    drop(pending) {
        const key = `${pending.kind}:${pending.userId}`;
        if (this.pending.get(key) === pending)
            this.pending.delete(key);
        clearTimeout(pending.timer);
    }
    /**
     * Ask one user the given questions over IM. Rejects on timeout or delivery
     * failure so the agent's ask_user_question surfaces the miss.
     */
    async ask(kind, userId, questions) {
        const key = `${kind}:${userId}`;
        const existing = this.pending.get(key);
        if (existing !== undefined) {
            // 同用户上一问未答：取消旧问，保留最新（与审批一致的串行语义）。
            this.drop(existing);
            existing.reject(new Error('用户开始了新的提问，旧问题已取消'));
        }
        return await new Promise((resolve, reject) => {
            const pending = {
                kind, userId, questions,
                resolve, reject,
                timer: undefined,
            };
            pending.timer = setTimeout(() => {
                this.log(`提问超时未回复（${questions.map(q => q.id).join(',')}），取消`);
                this.drop(pending);
                void this.notify(kind, userId, '⏱ 提问超时已取消。');
                reject(new Error('IM 提问超时未回复'));
            }, QUESTION_TIMEOUT_MS);
            pending.timer.unref?.();
            this.pending.set(key, pending);
            void this.notify(kind, userId, questionText(questions)).then(delivered => {
                if (!delivered) {
                    this.drop(pending);
                    reject(new Error('IM 提问推送失败（用户无可达目标）'));
                }
            });
        });
    }
    /**
     * Router hook: consume one reply as the answer to the user's pending
     * question. Slash commands are never consumed. Returns true when consumed.
     */
    consumeReply(kind, userId, text, commandPrefix = '/') {
        if (text.startsWith(commandPrefix))
            return false;
        const pending = this.pending.get(`${kind}:${userId}`);
        if (pending === undefined)
            return false;
        this.drop(pending);
        const answers = pending.questions.map((question, index) => index === 0
            ? answerForQuestion(question, text)
            : answerForQuestion(question, ''));
        void this.notify(kind, userId, '✅ 已收到你的回答。');
        pending.resolve({ answers });
        return true;
    }
}
