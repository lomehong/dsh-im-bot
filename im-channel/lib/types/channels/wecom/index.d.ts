/**
 * 企业微信智能机器人通道（WeCom AI Bot），基于 @wecom/aibot-node-sdk 的 WebSocket 长连接。
 *
 * 与企业微信管理后台的 BotID + Secret 配对使用：
 *   管理后台 → 应用 → 智能机器人 → API 接收事件 → 长连接
 *
 * 消息流：SDK WebSocket 回调 → 标准化为 InboundMessage → 路由到 DSH agent
 * 回复流：agent 回复 → replyStream 流式推送（打字机效果）
 */
import type { ApprovalAction, ApprovalCardRequest, ImChannel, InboundMessage, OutboundMessage, ReplyTarget, TurnMode, TurnSink } from '../../core/channel.ts';
/** 通道凭证持久化路径：~/.dsh/im-channel/credentials/wecom.json */
export interface WecomCredentials {
    botId: string;
    secret: string;
}
export declare function loadWecomCredentials(): WecomCredentials | undefined;
export declare function saveWecomCredentials(credentials: WecomCredentials): void;
/** MCP 配置持久化路径：~/.dsh/im-channel/credentials/wecom-mcp.json */
export interface WecomMcpConfig {
    mcpServers: Record<string, {
        type: string;
        url: string;
    }>;
}
export declare function loadWecomMcpConfig(): WecomMcpConfig | undefined;
export declare function saveWecomMcpConfig(config: WecomMcpConfig): void;
export interface WecomChannelOptions {
    /** 诊断日志接收器 */
    log?: (line: string) => void;
}
export declare class WecomChannel implements ImChannel {
    private readonly options;
    readonly kind: "wecom";
    readonly label = "\u4F01\u4E1A\u5FAE\u4FE1";
    /** 当前活跃实例，供 LoginApi 更改凭证后触发重连 */
    static activeInstance: WecomChannel | undefined;
    private handler;
    private client;
    /** 最近收到的消息帧，按 reqId 索引，用于 replyStream 回传 */
    private readonly recentFrames;
    /** 每个用户/群最近一条消息的 reqId，按 targetId 索引 */
    private readonly latestReqId;
    /** 最近收到的消息 ID 去重 */
    private readonly seenMessageIds;
    private static readonly SEEN_LIMIT;
    /** 死通道监听器 */
    private deadHandlers;
    /** 审批卡片按钮决策回调（template_card_event → 桥接层）。 */
    private approvalHandlers;
    /** 用于区分 SDK 端事件与我们的定时器 */
    private cleanTimer;
    /** 认证状态跟踪：企微只认「最新活跃连接」，未认证成功的连接收不到消息，
     * 拉起方必须拿到 authenticated 证据才算上线成功（生产曾踩：连上了但
     * 未认证，/bind 无响应直到重启）。 */
    private authenticated;
    /** 连续认证失败次数（认证成功即清零） */
    private authFailures;
    /** 连续认证失败达到该值视为凭证不可用（密钥错/机器人被删） */
    private static readonly AUTH_FAILURE_LIMIT;
    private authWaiters;
    constructor(options?: WecomChannelOptions);
    private log;
    isConfigured(): boolean;
    connect(): Promise<void>;
    /** 停掉当前 WSClient 与清理定时器（connect 幂等守卫与 stop 共用）。 */
    private teardownClient;
    /** 认证成功：唤醒所有 waitAuthenticated 等待者。 */
    private settleAuthWaiters;
    /**
     * 错误事件可能是瞬时网络问题，也可能是凭证被拒；仅在未认证时累计失败数，
     * 达到上限才判死（密钥错误/机器人被删），唤醒等待者以失败。
     */
    private noteAuthFailure;
    /**
     * 等待认证成功（拉起验证）。resolve = 已通过认证可收消息；
     * reject = 超时或连续认证失败判死。供 reconnect/bringChannelUp 拿到
     * 「真正上线」的证据，而不是「socket 建上了」的假阳性。
     */
    waitAuthenticated(timeoutMs?: number): Promise<void>;
    /**
     * 使用最新凭证重新连接（凭证文件已更新后调用）。
     * 等待认证成功才算完成；失败抛错，让调用方（bringChannelUp）兜底
     * 全量 reload——生产曾踩：reconnect 只建连不验证，连接未认证时
     * 调用方以为已上线，/bind 一直无响应。
     */
    reconnect(): Promise<void>;
    /** 下载企微图片（URL 5 分钟有效；长连接模式返回 AES 加密数据需解密）。 */
    private dispatchImage;
    onMessage(handler: (message: InboundMessage) => void): void;
    onDead(handler: (reason: string) => void): void;
    private reportDead;
    /**
     * 处理收到的消息帧
     */
    private handleIncoming;
    /**
     * 发送回复：通过主动推送通道发送 Markdown 消息
     */
    /** 发送 button_interaction 模板卡片（允许/拒绝），事件经同连接回传。 */
    sendApprovalCard(target: ReplyTarget, card: ApprovalCardRequest): Promise<boolean>;
    onApprovalAction(handler: (action: ApprovalAction) => void): void;
    send(target: ReplyTarget, message: OutboundMessage): Promise<void>;
    /**
     * 打开流式回合：使用 replyStream 实现打字机效果
     * 企业微信支持流式回复（stream reply），通过多次调用 replyStream 实现
     */
    openTurn(target: ReplyTarget, options: {
        mode: TurnMode;
    }): Promise<TurnSink>;
    stop(): Promise<void>;
    /** 清理过期缓存的帧和消息 ID */
    private pruneStale;
}
