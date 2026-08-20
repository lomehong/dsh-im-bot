/**
 * WeCom intelligent-bot quick-create QR auth: scan with the WeCom app to
 * CREATE a bot on the user's account and receive its credentials directly.
 * Ported from xmanrui/dsh-im's qr-auth.mjs (MIT) — two plain GET endpoints,
 * no SDK dependency.
 *
 *   generate → { scode, auth_url }  (render auth_url as the QR image)
 *   query_result?scode=… → success carries { botid, secret }
 */
export interface WecomQrStart {
    scode: string;
    verificationUrl: string;
    expiresAt: number;
    pollIntervalMs: number;
}
export type WecomQrPoll = {
    status: 'success';
    botId: string;
    secret: string;
} | {
    status: 'waiting';
} | {
    status: 'expired' | 'failed';
};
export declare class WecomQrAuth {
    private readonly platform;
    constructor(options?: {
        source?: string;
        platform?: number;
    });
    private readonly source;
    start(options?: {
        signal?: AbortSignal;
    }): Promise<WecomQrStart>;
    poll(scode: string, options?: {
        signal?: AbortSignal;
    }): Promise<WecomQrPoll>;
}
