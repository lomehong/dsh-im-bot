/**
 * Feishu/Lark channel: official @larksuiteoapi/node-sdk WebSocket long
 * connection (WSClient). A self-built app with bot capability provides
 * appId/appSecret; im.message.receive_v1 feeds the router; replies go
 * through the REST message API via the SDK client.
 *
 * Live turns prefer a CardKit STREAMING card (cardkit/v1): one card whose
 * markdown element is fed full-text snapshots, and the Feishu client
 * renders the typewriter animation itself (requires the cardkit:card:write
 * scope). Without that scope the sink degrades to a raw interactive card
 * updated via message.patch, then to a text message edited via
 * message.update.
 */
import type { ApprovalAction, ApprovalCardRequest, ImChannel, InboundMessage, OutboundMessage, ReplyTarget, TurnMode, TurnSink } from '../../core/channel.ts';
/** Channel credentials persisted at ~/.dsh/im-channel/credentials/feishu.json. */
export interface FeishuCredentials {
    appId: string;
    appSecret: string;
}
export declare function loadFeishuCredentials(): FeishuCredentials | undefined;
export declare function saveFeishuCredentials(credentials: FeishuCredentials): void;
export interface FeishuChannelOptions {
    /** Diagnostic sink (wired to the plugin logger). */
    log?: (line: string) => void;
}
export declare class FeishuChannel implements ImChannel {
    private readonly options;
    readonly kind: "feishu";
    readonly label = "\u98DE\u4E66";
    private handler;
    /** 审批卡片按钮决策回调（card.action.trigger → 桥接层）。 */
    private approvalHandlers;
    private client;
    private wsClient;
    constructor(options?: FeishuChannelOptions);
    private log;
    isConfigured(): boolean;
    connect(): Promise<void>;
    onMessage(handler: (message: InboundMessage) => void): void;
    /** Send a reply: markdown renders as an interactive card, else plain text. */
    send(target: ReplyTarget, message: OutboundMessage): Promise<void>;
    private sendContent;
    private dispatchSend;
    /**
     * Open a live turn: one interactive card patched in place as the agent
     * works, so the user watches progress instead of staring at silence.
     */
    openTurn(target: ReplyTarget, options: {
        mode: TurnMode;
    }): Promise<TurnSink>;
    /** 发送带 允许/拒绝 按钮的审批卡片（schema 1.0 interactive；value 携带 token）。 */
    sendApprovalCard(target: ReplyTarget, card: ApprovalCardRequest): Promise<boolean>;
    onApprovalAction(handler: (action: ApprovalAction) => void): void;
    /** card.action.trigger 载荷 → ApprovalAction（value 内嵌 token 与决策）。 */
    private onCardAction;
    stop(): Promise<void>;
    /** 下载并路由一条图片消息（messageResource 流式读取，失败静默记日志）。 */
    private dispatchImage;
    private dispatch;
}
