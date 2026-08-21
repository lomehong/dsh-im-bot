/**
 * Browser-facing login surface: one webServer route pair per boot that starts
 * a QR login for any supported platform and reports its status. The QR
 * image renders in the browser from the URL the platform returns; the host
 * only brokers the credential exchange.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Session record the platform login bridges write the QR URL onto. */
export interface QrLoginBridge {
    qrUrl: string | undefined;
}
export declare class LoginApi {
    private readonly ctx;
    private session;
    /** 企业微信扫码创建会话（scode），start 时建立、status 轮询消费。 */
    private wecomQr;
    constructor(ctx: Context);
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
    /** Read the im-channel settings section values this surface reports. */
    private readSettingsSection;
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
    /** POST /im-channel/mcp-servers/test {url}：连接测试，返回可达性与工具列表。 */
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
     * @returns true 当该平台实例行已存在（本次未写 settings，onChange 不会
     *   被 trigger——调用方需自行拉起通道，见 bringChannelUp）。
     */
    private ensureChannelInstance;
    /**
     * 凭证保存成功后让通道尽快上线。两条路：
     * - wecom 通道在线（activeInstance 存在）→ reconnect() 热替换凭证；
     * - 其余情况（冷启动：实例先建、凭证后到，通道从未起来；或微信/飞书
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
