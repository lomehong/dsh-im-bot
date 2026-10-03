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
export declare const QUESTION_TIMEOUT_MS: number;
export interface QuestionOption {
    label: string;
    description?: string;
}
export interface QuestionItem {
    id: string;
    question: string;
    detail?: string;
    header?: string;
    options?: QuestionOption[];
    multiSelect?: boolean;
}
export interface QuestionAnswerItem {
    id: string;
    selected: string[];
    custom?: string;
}
export interface QuestionAnswer {
    answers: QuestionAnswerItem[];
}
/** Parse a reply into the structured answer for one question. */
export declare function answerForQuestion(question: QuestionItem, text: string): QuestionAnswerItem;
/** Render questions as IM text with numbered options (borrowed format). */
export declare function questionText(questions: QuestionItem[]): string;
/**
 * Per-host coordinator: one outstanding question per channel user (the reply
 * channel is the asking user's chat). The router consults consumeReply()
 * before normal routing so answers never reach the agent as chat input.
 */
export declare class QuestionBridge {
    private readonly notify;
    private readonly cancel;
    private readonly log;
    /** P1.5 选项按钮卡发送钩子（提问升级的卡片形态；返回主动定稿闭包供文字/超时/替换路径让按钮失效）。 */
    private readonly sendQuestionCard?;
    private readonly pending;
    constructor(notify: (kind: string, userId: string, text: string) => Promise<boolean>, cancel?: (kind: string, userId: string) => boolean, log?: (line: string) => void, 
    /** P1.5 选项按钮卡发送钩子（提问升级的卡片形态；返回主动定稿闭包供文字/超时/替换路径让按钮失效）。 */
    sendQuestionCard?: ((kind: string, userId: string, card: import("../core/channel.ts").ApprovalCardRequest) => Promise<boolean | {
        ok: boolean;
        settle?: (outcome: "allowed" | "rejected" | "timeout") => Promise<void>;
    }>) | undefined);
    hasPendingFor(kind: string, userId: string): boolean;
    private drop;
    /**
     * Ask one user the given questions over IM. Rejects on timeout or delivery
     * failure so the agent's ask_user_question surfaces the miss.
     */
    ask(kind: string, userId: string, questions: QuestionItem[], opts?: {
        buttonToken?: string;
        useCard?: boolean;
    }): Promise<QuestionAnswer>;
    /** P1.5 选项按钮点击：按 buttonToken 找待决提问，解析为该选项的答案。
     *  仅 Owner 本人点击被接受（与审批桥同款纵深防御）。 */
    resolveByButtonToken(token: string, optionIdx: number, userId: string, settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>): boolean;
    /**
     * Router hook: consume one reply as the answer to the user's pending
     * question. Slash commands are never consumed. Returns true when consumed.
     */
    consumeReply(kind: string, userId: string, text: string, commandPrefix?: string): boolean;
}
