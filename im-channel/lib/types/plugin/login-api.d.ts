/**
 * Browser-facing login surface: one webServer route pair per boot that starts
 * a QR login for any supported platform and reports its status. The QR
 * image renders in the browser from the URL the platform returns; the host
 * only brokers the credential exchange.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
/**
 * im-channel 配置节视图（0.1.7 契约，docs/migration-0.1.7.md §4-T3）：
 * 配置权威 = Loader 注入 apply(config)，插件重载即最新；读取不需要 settings。
 */
export interface LoginSectionView {
    read(): {
        channels?: Record<string, {
            kind: 'feishu' | 'wechat' | 'wecom';
            enabled?: boolean;
        }>;
        guestTools?: string[];
        guestCommands?: string[];
        memoryAssemblePerTurn?: boolean;
    };
}
/** webServer 路由注册面（exact 路由）。 */
export interface RouteWeb {
    register(route: {
        kind: 'exact';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** Session record the platform login bridges write the QR URL onto. */
export interface QrLoginBridge {
    qrUrl: string | undefined;
}
export declare class LoginApi {
    private readonly ctx;
    private readonly section;
    private session;
    /** 企业微信扫码创建会话（scode），start 时建立、status 轮询消费。 */
    private wecomQr;
    /**
     * 企业微信扫码轮询协调器：同一 scode 的并发轮询共享一次外部请求
     * （single-flight），2.5s 内的重复轮询直接回缓存。企微外部接口 10s 超时，
     * 若无折叠，客户端 1.5~3s 一轮的轮询在外部服务变慢时会堆积并占满浏览器
     * 每主机 6 连接，拖死整个设置页；折叠后外部调用量上界 = 每客户端轮询
     * 间隔至多一次，与并发数无关。
     */
    private readonly wecomQrPolls;
    /**
     * @param ctx 插件根上下文——服务读取（get('settings')/'im-channel'）统一走这里。
     *  曾在 webServer 注入回调的子上下文上 inject(['settings'])：回调体内
     *  settings.get 在 0.1.7 已不存在，TypeError 落在 Promise executor 之外，
     *  永不 settle → 访客权限永久「加载中」、企微实例行写不进（通道离线、
     *  /bind 无响应）——0.1.7 契约下读值一律走节视图、写值走 get+update。
     * @param scoped webServer 注入回调的上下文（仅用于取 webServer 句柄注册路由）。
     * @param section 配置节视图（apply(config) 的惰性读取面）。
     */
    constructor(ctx: Context, scoped: {
        webServer?: RouteWeb;
    }, section: LoginSectionView);
    private readonly web;
    /** 读取 settings 服务（写路径专用）；缺席时返回 undefined，调用方显式报错。 */
    private settingsWriter;
    /** Register the /im-channel/login/* routes on the web server. */
    register(): void;
    /** GET /im-channel/guest-permissions：当前配置 + 工具/命令目录 + Owner 状态。 */
    private handleGuestPermissions;
    /** POST /im-channel/guest-permissions/update：保存访客工具/命令白名单。 */
    private handleGuestPermissionsUpdate;
    /** POST /im-channel/test-send {kind}：向该渠道最近绑定的用户发测试消息。 */
    private handleTestSend;
    /** The first bound userId of a channel kind (test-send target). */
    private userIdForFirstBinding;
    /** 读取配置节当前值（0.1.7：apply(config) 的节视图，同步、零注入）。 */
    private readSection;
    private handleBindingRemove;
    private handleWecomConfigure;
    /** GET /im-channel/wecom/qr/start：生成扫码创建机器人的二维码。 */
    private handleWecomQrStart;
    /** GET /im-channel/wecom/qr/status?scode=…：轮询扫码状态；成功即保存凭证并连接。 */
    private handleWecomQrStatus;
    private handleWecomMcpConfigure;
    private handleWecomMcpConfig;
    /** GET /im-channel/bots/status：三平台机器人状态（配置/在线/账号/绑定用户数）。 */
    private handleBotsStatus;
    private handleMcpServersList;
    private handleMcpServerAdd;
    /** POST /im-channel/mcp-servers/test {url | command}：连接测试，返回可达性与工具列表。 */
    private handleMcpServerTest;
    /** POST /im-channel/mcp-servers/parse {text}：解析粘贴的 URL/JSON 为候选列表。 */
    private handleMcpServerParse;
    private handleMcpServerUpdate;
    private handleMcpServerRemove;
    /**
     * Auto-create a channel instance in settings once a platform login is
     * confirmed so the router (re)starts without manual configuration. One
     * instance per platform: the wechat protocol allows exactly one poll
     * session per bot token, and duplicate instances multiply every reply.
     *
     * 0.1.7：实例行经 settings.update 写条目配置 → configEditor 应用 → Loader
     * 重载本插件（apply 重入）→ rebuildRouter 自动发生，不再依赖 onChange。
     *
     * @returns true 当该平台实例行已存在（本次未写配置，重载不会发生——
     *   调用方需自行拉起通道，见 bringChannelUp）。
     */
    private ensureChannelInstance;
    /**
     * 凭证保存成功后让通道尽快上线。两条路：
     * - wecom 通道在线（activeInstance 存在）→ reconnect() 热替换凭证，
     *   并等待认证成功；认证失败则落入 reload 兜底（不能只 warn 了事：
     *   未认证的连接收不到消息，/bind 会一直无响应）。
     * - 其余情况（冷启动：实例先建、凭证后到，通道从未起来；或者微信/飞书
     *   换号需要重开轮询）→ 调 im-channel 服务 reload() 强制重建路由，
     *   不依赖 settings 变化触发 onChange。
     */
    private bringChannelUp;
    private handleBindings;
    private readBindings;
    private handleStart;
    private runLogin;
    private handleStatus;
}
