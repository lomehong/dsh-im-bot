/**
 * 企业微信智能机器人通道（WeCom AI Bot），基于 @wecom/aibot-node-sdk 的 WebSocket 长连接。
 *
 * 与企业微信管理后台的 BotID + Secret 配对使用：
 *   管理后台 → 应用 → 智能机器人 → API 接收事件 → 长连接
 *
 * 消息流：SDK WebSocket 回调 → 标准化为 InboundMessage → 路由到 DSH agent
 * 回复流：agent 回复 → replyStream 流式推送（打字机效果）
 */
import type { ImChannel, InboundMessage, OutboundMessage, ReplyTarget, TurnMode, TurnSink } from '../../core/channel.ts';
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
    /** 用于区分 SDK 端事件与我们的定时器 */
    private cleanTimer;
    constructor(options?: WecomChannelOptions);
    private log;
    isConfigured(): boolean;
    connect(): Promise<void>;
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
