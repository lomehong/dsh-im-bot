/**
 * WeCom intelligent-bot quick-create QR auth: scan with the WeCom app to
 * CREATE a bot on the user's account and receive its credentials directly.
 * Ported from xmanrui/dsh-im's qr-auth.mjs (MIT) — two plain GET endpoints,
 * no SDK dependency.
 *
 *   generate → { scode, auth_url }  (render auth_url as the QR image)
 *   query_result?scode=… → success carries { botid, secret }
 */
const GENERATE_URL = 'https://work.weixin.qq.com/ai/qc/generate';
const POLL_URL = 'https://work.weixin.qq.com/ai/qc/query_result';
const QR_TTL_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 3_000;
function defaultPlatform() {
    if (process.platform === 'win32')
        return 2;
    if (process.platform === 'linux')
        return 3;
    return 1;
}
function cleanString(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
/** Only https URLs on the official WeCom domain may become QR targets. */
function safeVerificationUrl(value) {
    const raw = cleanString(value);
    if (raw === null)
        return null;
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' && url.hostname === 'work.weixin.qq.com' && (url.port === '' || url.port === '443')
            ? url.href
            : null;
    }
    catch {
        return null;
    }
}
async function requestJson(url, signal) {
    const timer = AbortSignal.timeout(10_000);
    const response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: signal === undefined ? timer : AbortSignal.any([signal, timer]),
        headers: { accept: 'application/json' },
    });
    if (!response.ok)
        throw new Error(`企业微信扫码服务返回 HTTP ${response.status}`);
    return await response.json();
}
export class WecomQrAuth {
    platform;
    constructor(options = {}) {
        const platform = options.platform ?? defaultPlatform();
        this.source = options.source ?? 'deepseek-harness';
        this.platform = [1, 2, 3].includes(platform) ? platform : defaultPlatform();
    }
    source;
    async start(options = {}) {
        const url = new URL(GENERATE_URL);
        url.searchParams.set('source', this.source);
        url.searchParams.set('plat', String(this.platform));
        const body = await requestJson(url.href, options.signal);
        const data = (body.data ?? {});
        const scode = cleanString(data.scode);
        const verificationUrl = safeVerificationUrl(data.auth_url);
        if (scode === null || verificationUrl === null)
            throw new Error('企业微信扫码服务返回数据无效');
        return { scode, verificationUrl, expiresAt: Date.now() + QR_TTL_MS, pollIntervalMs: POLL_INTERVAL_MS };
    }
    async poll(scode, options = {}) {
        const url = new URL(POLL_URL);
        url.searchParams.set('scode', scode);
        const body = await requestJson(url.href, options.signal);
        const data = (body.data ?? {});
        const state = cleanString(data.status)?.toLowerCase();
        if (state === 'success') {
            const botInfo = (data.bot_info ?? {});
            const botId = cleanString(botInfo.botid);
            const secret = cleanString(botInfo.secret);
            if (botId === null || secret === null)
                throw new Error('企业微信扫码结果缺少机器人凭证');
            return { status: 'success', botId, secret };
        }
        if (state === 'expired' || state === 'timeout')
            return { status: 'expired' };
        if (state === 'fail' || state === 'failed' || state === 'error')
            return { status: 'failed' };
        return { status: 'waiting' };
    }
}
