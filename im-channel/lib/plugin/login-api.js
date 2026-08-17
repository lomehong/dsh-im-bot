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
