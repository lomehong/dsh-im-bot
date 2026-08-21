/**
 * Browser-facing login surface: one webServer route pair per boot that starts
 * a QR login for any supported platform and reports its status. The QR
 * image renders in the browser from the URL the platform returns; the host
 * only brokers the credential exchange.
 */
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
const KINDS = ['wechat', 'feishu', 'wecom'];
const KIND_LABELS = {
    wechat: '微信',
    feishu: '飞书',
    wecom: '企业微信',
};
const NS = settingsNamespace('im-channel');
const SESSION_TTL_MS = 8 * 60_000;
export class LoginApi {
    ctx;
    session;
    /** 企业微信扫码创建会话（scode），start 时建立、status 轮询消费。 */
    wecomQr;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /** Register the /im-channel/login/* routes on the web server. */
    register() {
        // Narrow local view of the webServer service: the runtime name and the
        // published typings' augmentation have drifted between harness versions
        // (webServer locally, httpServer in older published rc's), so reach
        // through a structural cast that compiles against both.
        const web = this.ctx.webServer;
        web.register({
            kind: 'exact',
            path: '/im-channel/login/start',
            handler: (req, res) => void this.handleStart(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/login/status',
            handler: (_req, res) => this.handleStatus(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/bindings',
            handler: (_req, res) => this.handleBindings(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/bindings/remove',
            handler: (req, res) => void this.handleBindingRemove(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/wecom/configure',
            handler: (req, res) => void this.handleWecomConfigure(req, res),
        });
        // 企业微信扫码创建智能机器人（qc 快速创建服务）：扫码即建即得凭证。
        web.register({
            kind: 'exact',
            path: '/im-channel/wecom/qr/start',
            handler: (_req, res) => void this.handleWecomQrStart(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/wecom/qr/status',
            handler: (req, res) => void this.handleWecomQrStatus(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/wecom/mcp-configure',
            handler: (req, res) => void this.handleWecomMcpConfigure(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/wecom/mcp-config',
            handler: (_req, res) => void this.handleWecomMcpConfig(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers',
            handler: (_req, res) => void this.handleMcpServersList(res),
        });
        // 三平台机器人状态汇总：控制台右缘状态栏数据源（配置/在线/账号/绑定用户数）。
        web.register({
            kind: 'exact',
            path: '/im-channel/bots/status',
            handler: (_req, res) => void this.handleBotsStatus(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers/add',
            handler: (req, res) => void this.handleMcpServerAdd(req, res),
        });
        // 连接测试：按运行时相同方式调用 tools/list，探测可达性与工具列表。
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers/test',
            handler: (req, res) => void this.handleMcpServerTest(req, res),
        });
        // 粘贴解析：把裸 URL / mcpServers JSON 文本解析为候选列表（预览后批量导入）。
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers/parse',
            handler: (req, res) => void this.handleMcpServerParse(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers/update',
            handler: (req, res) => void this.handleMcpServerUpdate(req, res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/mcp-servers/remove',
            handler: (req, res) => void this.handleMcpServerRemove(req, res),
        });
        // 连接测试：向该渠道最近绑定的用户推送测试消息（不建会话、不调模型）。
        web.register({
            kind: 'exact',
            path: '/im-channel/test-send',
            handler: (req, res) => void this.handleTestSend(req, res),
        });
        // 访客权限（数字分身模型）：Owner 在设置页配置访客可用的工具与命令。
        web.register({
            kind: 'exact',
            path: '/im-channel/guest-permissions',
            handler: (_req, res) => void this.handleGuestPermissions(res),
        });
        web.register({
            kind: 'exact',
            path: '/im-channel/guest-permissions/update',
            handler: (req, res) => void this.handleGuestPermissionsUpdate(req, res),
        });
    }
    /** GET /im-channel/guest-permissions：当前配置 + 工具/命令目录 + Owner 状态。 */
    handleGuestPermissions(res) {
        void (async () => {
            try {
                const { GUEST_TOOL_CATALOG, GUEST_COMMAND_CATALOG, DEFAULT_GUEST_COMMANDS } = await import("../core/guest-permissions.js");
                const { BindStore } = await import("../core/bind-store.js");
                const section = await this.readSettingsSection();
                const owners = {};
                for (const kind of KINDS) {
                    const owner = BindStore.shared.ownerFor(kind);
                    owners[kind] = owner === undefined
                        ? { bound: false, userId: '' }
                        : { bound: true, userId: `${owner.userId.slice(0, 8)}…` };
                }
                respondJson(res, 200, {
                    ok: true,
                    guestTools: section.guestTools ?? [],
                    guestCommands: section.guestCommands ?? [...DEFAULT_GUEST_COMMANDS],
                    toolCatalog: GUEST_TOOL_CATALOG,
                    commandCatalog: GUEST_COMMAND_CATALOG,
                    owners,
                });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        })();
    }
    /** POST /im-channel/guest-permissions/update：保存访客工具/命令白名单。 */
    async handleGuestPermissionsUpdate(req, res) {
        try {
            const body = await readJsonBody(req);
            const patch = {};
            if (Array.isArray(body.guestTools))
                patch.guestTools = body.guestTools.filter((v) => typeof v === 'string' && v.trim().length > 0).map(v => v.trim());
            if (Array.isArray(body.guestCommands))
                patch.guestCommands = body.guestCommands.filter((v) => typeof v === 'string' && v.trim().length > 0).map(v => v.trim());
            if (Object.keys(patch).length === 0) {
                respondJson(res, 400, { ok: false, error: 'guestTools/guestCommands 至少提供一个有效数组' });
                return;
            }
            await new Promise((resolve, reject) => {
                this.ctx.inject(['settings'], sctx => {
                    void sctx.settings.update(NS, patch).then(resolve, reject);
                });
            });
            respondJson(res, 200, { ok: true });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** POST /im-channel/test-send {kind}：向该渠道最近绑定的用户发测试消息。 */
    async handleTestSend(req, res) {
        try {
            const body = await readJsonBody(req);
            const kind = body.kind;
            if (typeof kind !== 'string' || !KINDS.includes(kind)) {
                respondJson(res, 400, { ok: false, error: `kind 必须是 ${KINDS.join('/')}` });
                return;
            }
            const push = this.ctx.get('im-channel')?.pushToUser;
            if (push === undefined) {
                respondJson(res, 500, { ok: false, error: '推送服务不可用（路由未就绪）' });
                return;
            }
            const userId = await this.userIdForFirstBinding(kind);
            if (userId === '') {
                respondJson(res, 404, { ok: false, error: `尚无 ${kind} 绑定用户，无法发送测试消息` });
                return;
            }
            const delivered = await push(kind, userId, '✅ DeepSeek Harness 连接测试成功', { markdown: false });
            respondJson(res, 200, { ok: delivered, delivered, error: delivered ? undefined : '发送失败（无可达目标或渠道未连接）' });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** The first bound userId of a channel kind (test-send target). */
    async userIdForFirstBinding(kind) {
        const { BindStore } = await import("../core/bind-store.js");
        const rows = BindStore.shared.rowsForListing();
        return rows.find(row => row.kind === kind)?.userId ?? '';
    }
    /** Read the im-channel settings section values this surface reports. */
    async readSettingsSection() {
        return await new Promise(resolve => {
            this.ctx.inject(['settings'], sctx => {
                const section = sctx.settings.get(NS);
                resolve(section ?? {});
            });
        });
    }
    async handleBindingRemove(req, res) {
        try {
            const body = await readJsonBody(req);
            const { removeBinding } = await import("../core/bind-store.js");
            const match = {};
            if (typeof body.kind === 'string')
                match.kind = body.kind;
            if (typeof body.userId === 'string')
                match.userId = body.userId;
            if (typeof body.sessionId === 'string')
                match.sessionId = body.sessionId;
            const removed = removeBinding(match);
            respondJson(res, 200, { ok: true, removed });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async handleWecomConfigure(req, res) {
        try {
            const body = await readJsonBody(req);
            if (typeof body.botId !== 'string' || typeof body.secret !== 'string') {
                respondJson(res, 400, { ok: false, error: '需要 BotID 和 Secret' });
                return;
            }
            const { configureWecomBot } = await import("../channels/wecom/login-bridge.js");
            await configureWecomBot(body.botId, body.secret);
            // 自动创建通道实例
            await this.ensureChannelInstance('wecom');
            // 触发重连，让新凭证立即生效
            try {
                const { WecomChannel } = await import("../channels/wecom/index.js");
                await WecomChannel.activeInstance?.reconnect();
            }
            catch (e) {
                // 重连失败不影响凭证保存
                this.ctx.logger.warn(`im-channel: 企业微信重连失败: ${messageOf(e)}`);
            }
            // 如果当前有登录会话，标记为已确认
            if (this.session !== undefined && this.session.kind === 'wecom') {
                this.session.status = 'confirmed';
            }
            respondJson(res, 200, { ok: true });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** GET /im-channel/wecom/qr/start：生成扫码创建机器人的二维码。 */
    handleWecomQrStart(res) {
        void (async () => {
            try {
                const { WecomQrAuth } = await import("../channels/wecom/qr-auth.js");
                const start = await new WecomQrAuth().start();
                this.wecomQr = { scode: start.scode, startedAt: Date.now() };
                respondJson(res, 200, { ok: true, qrUrl: start.verificationUrl, scode: start.scode, expiresAt: start.expiresAt, pollIntervalMs: start.pollIntervalMs });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        })();
    }
    /** GET /im-channel/wecom/qr/status?scode=…：轮询扫码状态；成功即保存凭证并连接。 */
    handleWecomQrStatus(req, res) {
        void (async () => {
            try {
                const url = new URL(req.url ?? '/', 'http://localhost');
                const scode = url.searchParams.get('scode') ?? this.wecomQr?.scode ?? '';
                if (scode === '' || (this.wecomQr !== undefined && this.wecomQr.scode !== scode)) {
                    respondJson(res, 400, { ok: false, error: '无效的扫码会话' });
                    return;
                }
                const { WecomQrAuth } = await import("../channels/wecom/qr-auth.js");
                const poll = await new WecomQrAuth().poll(scode);
                if (poll.status === 'success') {
                    const { configureWecomBot } = await import("../channels/wecom/login-bridge.js");
                    await configureWecomBot(poll.botId, poll.secret);
                    await this.ensureChannelInstance('wecom');
                    try {
                        const { WecomChannel } = await import("../channels/wecom/index.js");
                        await WecomChannel.activeInstance?.reconnect();
                    }
                    catch {
                        // 重连失败不影响凭证保存；重启后自然生效。
                    }
                    this.wecomQr = undefined;
                    respondJson(res, 200, { ok: true, status: 'confirmed' });
                    return;
                }
                respondJson(res, 200, { ok: true, status: poll.status });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        })();
    }
    async handleWecomMcpConfigure(req, res) {
        try {
            const body = await readJsonBody(req);
            if (!body.mcpServers) {
                respondJson(res, 400, { ok: false, error: '需要 MCP 服务器配置' });
                return;
            }
            const { saveWecomMcpConfigEx } = await import("../channels/wecom/login-bridge.js");
            await saveWecomMcpConfigEx(body.mcpServers);
            respondJson(res, 200, { ok: true });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async handleWecomMcpConfig(res) {
        try {
            const { loadWecomMcpConfig } = await import("../channels/wecom/index.js");
            const config = loadWecomMcpConfig();
            respondJson(res, 200, { ok: true, config: config ?? null });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** GET /im-channel/bots/status：三平台机器人状态（配置/在线/账号/绑定用户数）。 */
    handleBotsStatus(res) {
        void (async () => {
            try {
                const service = this.ctx.get('im-channel');
                const { collectBotStatus } = await import("../core/bot-status.js");
                const bots = service?.botsStatus?.() ?? collectBotStatus(undefined);
                respondJson(res, 200, { ok: true, bots });
            }
            catch (error) {
                respondJson(res, 500, { ok: false, error: messageOf(error) });
            }
        })();
    }
    async handleMcpServersList(res) {
        try {
            const { loadMcpServers } = await import("../channels/mcp-server-manager.js");
            const servers = loadMcpServers();
            respondJson(res, 200, { ok: true, servers });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async handleMcpServerAdd(req, res) {
        const { addMcpServer, McpManagerError } = await import("../channels/mcp-server-manager.js");
        try {
            const body = await readJsonBody(req);
            if (typeof body.url !== 'string' || body.url.trim() === '') {
                respondJson(res, 400, { ok: false, error: '需要 url（name 可省略，自动从地址生成）' });
                return;
            }
            const entry = addMcpServer({
                ...(typeof body.name === 'string' && body.name.trim() !== '' ? { name: body.name.trim() } : {}),
                type: body.type ?? 'streamable-http',
                url: body.url,
                enabled: true,
            });
            respondJson(res, 200, { ok: true, server: entry });
        }
        catch (error) {
            if (error instanceof McpManagerError) {
                respondJson(res, 400, { ok: false, error: error.message, code: error.code });
                return;
            }
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** POST /im-channel/mcp-servers/test {url}：连接测试，返回可达性与工具列表。 */
    async handleMcpServerTest(req, res) {
        try {
            const body = await readJsonBody(req);
            if (typeof body.url !== 'string' || body.url.trim() === '') {
                respondJson(res, 400, { ok: false, error: '需要 url' });
                return;
            }
            const { testMcpServer } = await import("../channels/mcp-server-manager.js");
            const result = await testMcpServer(body.url);
            respondJson(res, 200, { ok: true, result });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /** POST /im-channel/mcp-servers/parse {text}：解析粘贴的 URL/JSON 为候选列表。 */
    async handleMcpServerParse(req, res) {
        try {
            const body = await readJsonBody(req);
            if (typeof body.text !== 'string') {
                respondJson(res, 400, { ok: false, error: '需要 text' });
                return;
            }
            const { parseMcpImport } = await import("../channels/mcp-server-manager.js");
            const result = parseMcpImport(body.text);
            respondJson(res, 200, { ok: true, ...result });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async handleMcpServerUpdate(req, res) {
        const { updateMcpServer, McpManagerError } = await import("../channels/mcp-server-manager.js");
        try {
            const body = await readJsonBody(req);
            if (typeof body.id !== 'string') {
                respondJson(res, 400, { ok: false, error: '需要 id' });
                return;
            }
            const updated = updateMcpServer(body.id, {
                ...(body.name !== undefined ? { name: body.name } : {}),
                ...(body.type !== undefined ? { type: body.type } : {}),
                ...(body.url !== undefined ? { url: body.url } : {}),
                ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
            });
            respondJson(res, 200, { ok: updated });
        }
        catch (error) {
            if (error instanceof McpManagerError) {
                respondJson(res, 400, { ok: false, error: error.message, code: error.code });
                return;
            }
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async handleMcpServerRemove(req, res) {
        try {
            const body = await readJsonBody(req);
            if (typeof body.id !== 'string') {
                respondJson(res, 400, { ok: false, error: '需要 id' });
                return;
            }
            const { removeMcpServer } = await import("../channels/mcp-server-manager.js");
            const removed = removeMcpServer(body.id);
            respondJson(res, 200, { ok: removed });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    /**
     * Auto-create a channel instance in settings once a platform login is
     * confirmed so the router (re)starts without manual configuration. One
     * instance per platform: the wechat protocol allows exactly one poll
     * session per bot token, and duplicate instances multiply every reply.
     */
    async ensureChannelInstance(kind) {
        try {
            this.ctx.inject(['settings'], async (sctx) => {
                const section = sctx.settings.get(NS);
                const channels = section?.channels ?? {};
                const exists = Object.values(channels).some(v => v.kind === kind);
                if (exists)
                    return;
                await sctx.settings.update(NS, {
                    channels: {
                        [`${kind}-1`]: { kind, enabled: true, displayName: `${KIND_LABELS[kind]}机器人 1` },
                    },
                });
            });
        }
        catch (error) {
            this.ctx.logger.warn(`im-channel: 自动创建 ${kind} 实例失败: ${messageOf(error)}`);
        }
    }
    handleBindings(res) {
        // Read the persisted binding rows directly; each /bind adds one
        // user-to-session row per platform bot.
        void this.readBindings().then(rows => {
            respondJson(res, 200, {
                ok: true,
                bindings: rows,
                count: rows.length,
            });
        });
    }
    async readBindings() {
        try {
            const { listBindings } = await import("../core/bind-store.js");
            return listBindings();
        }
        catch {
            return [];
        }
    }
    async handleStart(req, res) {
        try {
            const body = await readJsonBody(req);
            const kind = body.kind;
            if (typeof kind !== 'string' || !KINDS.includes(kind)) {
                respondJson(res, 400, { ok: false, error: `kind must be one of ${KINDS.join(', ')}` });
                return;
            }
            const loginKind = kind;
            // A new card click is explicit intent to switch: retire any prior
            // pending session instead of rejecting the new login.
            const prior = this.session;
            if (prior !== undefined && prior.status === 'pending') {
                prior.status = 'error';
                prior.error = 'superseded by a new login';
            }
            const session = { kind: loginKind, startedAt: Date.now(), qrUrl: undefined, status: 'pending', error: undefined };
            this.session = session;
            // Start the platform login out-of-band; the QR URL and terminal state
            // land on the session record for status polling.
            void this.runLogin(loginKind, session);
            // Hold the start response briefly until the platform returns the QR
            // URL so the client can paint it immediately instead of waiting for
            // its first status poll.
            for (let waited = 0; waited < 100 && session.qrUrl === undefined && session.status === 'pending'; waited++) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Some platform bridges poll forever without timing out; cap the
            // session so the UI stops waiting after the TTL.
            setTimeout(() => {
                if (this.session === session && session.status === 'pending') {
                    session.status = 'error';
                    session.error = 'login timed out';
                }
            }, SESSION_TTL_MS).unref();
            // The QR URL arrives asynchronously from the platform; poll status.
            respondJson(res, 200, { ok: true, qrUrl: session.qrUrl });
        }
        catch (error) {
            respondJson(res, 500, { ok: false, error: messageOf(error) });
        }
    }
    async runLogin(kind, session) {
        try {
            switch (kind) {
                case 'wechat': {
                    const { beginWechatQrLogin } = await import("../channels/wechat/login-bridge.js");
                    await beginWechatQrLogin(session);
                    break;
                }
                case 'feishu': {
                    const { beginFeishuQrLogin } = await import("../channels/feishu/login-bridge.js");
                    await beginFeishuQrLogin(session);
                    break;
                }
                case 'wecom': {
                    const { beginWecomLogin } = await import("../channels/wecom/login-bridge.js");
                    await beginWecomLogin(session);
                    // 企业微信不需要扫码，保持 pending 状态，等待用户提交表单
                    return;
                }
            }
            session.status = 'confirmed';
            await this.ensureChannelInstance(kind);
        }
        catch (error) {
            session.status = 'error';
            session.error = messageOf(error);
        }
    }
    handleStatus(res) {
        const session = this.session;
        if (session === undefined || Date.now() - session.startedAt > SESSION_TTL_MS) {
            respondJson(res, 200, { ok: true, session: null });
            return;
        }
        respondJson(res, 200, {
            ok: true,
            session: {
                kind: session.kind,
                status: session.status,
                qrUrl: session.qrUrl,
                error: session.error,
                elapsedMs: Date.now() - session.startedAt,
            },
        });
    }
}
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data.length === 0 ? {} : JSON.parse(data));
            }
            catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}
function respondJson(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
