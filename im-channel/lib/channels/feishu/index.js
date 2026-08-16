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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as Lark from '@larksuiteoapi/node-sdk';
function credentialsPath() {
    return join(homedir(), '.dsh', 'im-channel', 'credentials', 'feishu.json');
}
export function loadFeishuCredentials() {
    const path = credentialsPath();
    if (!existsSync(path))
        return undefined;
    return JSON.parse(readFileSync(path, 'utf8'));
}
export function saveFeishuCredentials(credentials) {
    const path = credentialsPath();
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}
export class FeishuChannel {
    options;
    kind = 'feishu';
    label = '飞书';
    handler;
    client;
    wsClient;
    constructor(options = {}) {
        this.options = options;
    }
    log(line) {
        this.options.log?.(line);
    }
    isConfigured() {
        return loadFeishuCredentials() !== undefined;
    }
    async connect() {
        const credentials = loadFeishuCredentials();
        if (credentials === undefined)
            throw new Error('飞书通道未配置：先创建自建应用并保存 appId/appSecret');
        try {
            this.client = new Lark.Client({ appId: credentials.appId, appSecret: credentials.appSecret });
            this.wsClient = new Lark.WSClient({
                appId: credentials.appId,
                appSecret: credentials.appSecret,
                loggerLevel: Lark.LoggerLevel.warn,
            });
            await this.wsClient.start({
                eventDispatcher: new Lark.EventDispatcher({}).register({
                    'im.message.receive_v1': (data) => {
                        this.dispatch(data);
                        return Promise.resolve();
                    },
                }),
            });
            this.log('feishu 长连接已建立');
        }
        catch (error) {
            this.log(`feishu connect FAILED: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    onMessage(handler) {
        this.handler = handler;
    }
    /** Send a reply: markdown renders as an interactive card, else plain text. */
    async send(target, message) {
        if (this.client === undefined)
            throw new Error('飞书通道未连接');
        await this.sendContent(target, message);
    }
    async sendContent(target, message) {
        const client = this.client;
        if (client === undefined)
            throw new Error('飞书通道未连接');
        const replyTo = message.replyTo;
        if (message.markdown === true) {
            try {
                await this.dispatchSend(client, target, { msg_type: 'interactive', content: markdownCard(message.text) }, replyTo);
                return;
            }
            catch (error) {
                // Cards need extra app capabilities; degrade to text instead of
                // dropping the reply on the floor.
                this.log(`feishu 卡片发送失败，退回文本: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        await this.dispatchSend(client, target, { msg_type: 'text', content: JSON.stringify({ text: message.text }) }, replyTo);
    }
    async dispatchSend(client, target, body, replyTo) {
        if (replyTo !== undefined) {
            await client.im.v1.message.reply({ path: { message_id: replyTo }, data: body });
            return;
        }
        await client.im.v1.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: target.targetId, ...body },
        });
    }
    /**
     * Open a live turn: one interactive card patched in place as the agent
     * works, so the user watches progress instead of staring at silence.
     */
    async openTurn(target, options) {
        const client = this.client;
        if (client === undefined)
            throw new Error('飞书通道未连接');
        const sink = new FeishuTurnSink(client, target, line => this.log(line));
        await sink.start(options.mode);
        return sink;
    }
    async stop() {
        this.wsClient?.close();
    }
    dispatch(event) {
        const message = event.message;
        const openId = event.sender?.sender_id?.open_id;
        if (message?.chat_id === undefined || openId === undefined || message.message_id === undefined)
            return;
        if (message.message_type !== 'text')
            return;
        const isGroup = message.chat_type === 'group';
        // Group messages only reach the router when the bot was mentioned;
        // p2p chats always route.
        if (isGroup && (message.mentions ?? []).length === 0)
            return;
        let text = '';
        try {
            text = JSON.parse(message.content ?? '{}').text ?? '';
        }
        catch {
            return;
        }
        if (isGroup)
            text = text.replace(/@_user_\d+/g, '').trim();
        if (text.length === 0)
            return;
        this.handler?.({
            from: { kind: 'feishu', userId: openId },
            text,
            messageId: message.message_id,
            chatId: message.chat_id,
            ...(isGroup ? { mentioned: true } : {}),
        });
    }
}
/** Live-view cap for in-place updates: CardKit content API rejects >30KB. */
const STREAM_VIEW_CAP = 28_000;
/** Live-view cap for the message.patch fallback (keeps payloads small). */
const PATCH_VIEW_CAP = 4_000;
/** Final markdown content cap per card message. */
const CARD_CHUNK_LIMIT = 20_000;
/** Final plain-text cap per message. */
const TEXT_CHUNK_LIMIT = 3_500;
/** Spacing between in-place updates (CardKit streaming allows 50 QPS; this stays modest on purpose). */
const PATCH_INTERVAL_MS = 900;
/** element_id of the single markdown block inside the streaming card. */
const STREAM_ELEMENT_ID = 'md';
/**
 * One live turn rendered as a single Feishu message. Three strategies, in
 * degradation order:
 * - 'stream': CardKit streaming card (cardkit/v1). The PLATFORM renders the
 *   typewriter effect client-side from full-text snapshots we push, so text
 *   appears to type out char-by-char regardless of our update cadence.
 * - 'card': raw interactive card updated via message.patch (the official
 *   "update sent card" API) — whole-card replacement, no animation.
 * - 'text': plain text message edited via message.update.
 * Requires the cardkit:card:write scope for the first strategy; the others
 * degrade gracefully when it is missing.
 */
class FeishuTurnSink {
    client;
    target;
    log;
    messageId;
    /** CardKit card entity id for the 'stream' strategy. */
    cardId;
    strategy = 'stream';
    view = '⏳ 已收到，正在处理…';
    timer;
    liveBroken = false;
    finished = false;
    lastPatched;
    patchBusy = false;
    /** CardKit per-card operation counter; must strictly increase. */
    sequence = 0;
    startedAt = Date.now();
    patchCount = 0;
    constructor(client, target, log) {
        this.client = client;
        this.target = target;
        this.log = log;
    }
    async start(mode) {
        const ack = mode === 'quiet' ? '⏳ 已收到，正在处理…' : '⏳ 已收到，正在思考…';
        this.view = ack;
        // Strategy 1: CardKit streaming card.
        try {
            const cardResp = await this.client.cardkit.v1.card.create({
                data: { type: 'card_json', data: streamingCard(ack) },
            });
            const cardId = cardResp?.data?.card_id;
            if (cardId === undefined)
                throw new Error(`cardkit create code=${cardResp?.code ?? '?'} ${cardResp?.msg ?? ''}`);
            const msgResp = await this.client.im.v1.message.create({
                params: { receive_id_type: 'chat_id' },
                data: { receive_id: this.target.targetId, msg_type: 'interactive', content: JSON.stringify({ type: 'card', data: { card_id: cardId } }) },
            });
            const messageId = msgResp?.data?.message_id;
            if (messageId === undefined)
                throw new Error(`feishu send cardkit card code=${msgResp?.code ?? '?'} ${msgResp?.msg ?? ''}`);
            this.cardId = cardId;
            this.messageId = messageId;
            this.strategy = 'stream';
            this.timer = setInterval(() => { void this.flushLive(); }, PATCH_INTERVAL_MS);
            this.timer.unref?.();
            return;
        }
        catch (error) {
            this.log(`feishu CardKit 流式卡片不可用（缺 cardkit:card:write 权限或发送失败），退回卡片整刷: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Strategy 2: raw interactive card + message.patch.
        try {
            const resp = await this.client.im.v1.message.create({
                params: { receive_id_type: 'chat_id' },
                data: { receive_id: this.target.targetId, msg_type: 'interactive', content: markdownCard(ack) },
            });
            const id = resp?.data?.message_id;
            if (id === undefined)
                throw new Error(`feishu create card resp missing message_id: code=${resp?.code ?? '?'} ${resp?.msg ?? ''}`);
            this.messageId = id;
            this.strategy = 'card';
        }
        catch (error) {
            // Strategy 3: plain text ack edited via message.update.
            this.log(`feishu 卡片发送失败，退回文本编辑: ${error instanceof Error ? error.message : String(error)}`);
            const resp = await this.client.im.v1.message.create({
                params: { receive_id_type: 'chat_id' },
                data: { receive_id: this.target.targetId, msg_type: 'text', content: JSON.stringify({ text: ack }) },
            });
            const id = resp?.data?.message_id;
            if (id === undefined)
                throw new Error(`feishu create text resp missing message_id: code=${resp?.code ?? '?'} ${resp?.msg ?? ''}`);
            this.messageId = id;
            this.strategy = 'text';
        }
        this.timer = setInterval(() => { void this.flushLive(); }, PATCH_INTERVAL_MS);
        this.timer.unref?.();
    }
    update(view) {
        if (this.finished)
            return;
        this.view = view;
    }
    async finish(final) {
        if (this.finished)
            return;
        this.finished = true;
        this.stopTimer();
        try {
            if (this.strategy === 'stream') {
                // First chunk lands on the streaming card; the platform finishes the
                // typewriter pass, then we close streaming mode. Overflow becomes
                // follow-up card messages.
                const chunks = splitForBoundary(final.text, STREAM_VIEW_CAP);
                if (this.cardId !== undefined) {
                    await this.pushStreamContent(this.cardId, chunks[0] ?? '');
                    await this.closeStreaming(this.cardId);
                }
                for (let i = 1; i < chunks.length; i++)
                    await this.createCard(chunks[i]);
                this.log(`feishu 流式回合完成 strategy=stream patches=${this.patchCount} 耗时=${Math.round((Date.now() - this.startedAt) / 1000)}s`);
                return;
            }
            if (this.strategy === 'card') {
                // Patch the live card with the first chunk; extra chunks become
                // follow-up card messages.
                const chunks = splitForBoundary(final.text, CARD_CHUNK_LIMIT);
                for (let i = 0; i < chunks.length; i++) {
                    if (i === 0 && this.messageId !== undefined) {
                        await this.patchCard(this.messageId, chunks[0]);
                    }
                    else {
                        await this.createCard(chunks[i]);
                    }
                }
                this.log(`feishu 流式回合完成 strategy=card patches=${this.patchCount} 耗时=${Math.round((Date.now() - this.startedAt) / 1000)}s`);
                return;
            }
            if (this.strategy === 'text') {
                const chunks = splitForBoundary(final.text, TEXT_CHUNK_LIMIT);
                for (let i = 0; i < chunks.length; i++) {
                    if (i === 0 && this.messageId !== undefined) {
                        await this.editText(this.messageId, chunks[0]);
                    }
                    else {
                        await this.createText(chunks[i]);
                    }
                }
                return;
            }
            await this.sendFinalRaw(final);
        }
        catch (error) {
            this.log(`feishu 终稿下发失败，尝试兜底文本: ${error instanceof Error ? error.message : String(error)}`);
            try {
                await this.sendFinalRaw(final);
            }
            catch (retryError) {
                this.log(`feishu 终稿兜底也失败: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
            }
        }
    }
    async fail(message) {
        if (this.finished)
            return;
        this.finished = true;
        this.stopTimer();
        const text = message.length > TEXT_CHUNK_LIMIT ? `${message.slice(0, TEXT_CHUNK_LIMIT - 1)}…` : message;
        try {
            if (this.strategy === 'stream' && this.cardId !== undefined) {
                await this.pushStreamContent(this.cardId, text);
                await this.closeStreaming(this.cardId);
                return;
            }
            if (this.strategy === 'card' && this.messageId !== undefined) {
                await this.patchCard(this.messageId, text);
                return;
            }
            if (this.strategy === 'text' && this.messageId !== undefined) {
                await this.editText(this.messageId, text);
                return;
            }
            await this.createText(text);
        }
        catch (error) {
            this.log(`feishu 失败提示下发异常: ${error instanceof Error ? error.message : String(error)}`);
            try {
                await this.createText(text);
            }
            catch {
                // The channel is down; the router's error path has nothing left to do.
            }
        }
    }
    stopTimer() {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    /** Periodic in-place refresh of the live view. */
    async flushLive() {
        if (this.finished || this.liveBroken || this.patchBusy)
            return;
        if (this.strategy === 'stream') {
            const view = capView(this.view, STREAM_VIEW_CAP);
            if (view === this.lastPatched || this.cardId === undefined)
                return;
            this.patchBusy = true;
            try {
                await this.pushStreamContent(this.cardId, view);
                this.lastPatched = view;
                this.patchCount++;
            }
            catch (error) {
                // Stop live updates on the first failure (permission revoked mid-turn,
                // entity expiry, sequence race); the final content still goes out via
                // finish().
                this.liveBroken = true;
                this.stopTimer();
                this.log(`feishu 流式更新中断（终稿仍会下发）: ${error instanceof Error ? error.message : String(error)}`);
            }
            finally {
                this.patchBusy = false;
            }
            return;
        }
        const view = capView(this.view, PATCH_VIEW_CAP);
        if (view === this.lastPatched)
            return;
        const messageId = this.messageId;
        if (messageId === undefined)
            return;
        this.patchBusy = true;
        try {
            if (this.strategy === 'card')
                await this.patchCard(messageId, view);
            else
                await this.editText(messageId, view);
            this.lastPatched = view;
            this.patchCount++;
        }
        catch (error) {
            this.liveBroken = true;
            this.stopTimer();
            this.log(`feishu 流式更新中断（终稿仍会下发）: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            this.patchBusy = false;
        }
    }
    /** CardKit streaming text push: full snapshot; platform renders the typewriter diff. */
    async pushStreamContent(cardId, content) {
        const resp = await this.client.cardkit.v1.cardElement.content({
            path: { card_id: cardId, element_id: STREAM_ELEMENT_ID },
            data: { content, sequence: ++this.sequence },
        });
        assertOk(resp, 'feishu stream content');
    }
    /** Close CardKit streaming mode so the card becomes a normal forwardable card. */
    async closeStreaming(cardId) {
        try {
            const resp = await this.client.cardkit.v1.card.settings({
                path: { card_id: cardId },
                data: { settings: JSON.stringify({ config: { streaming_mode: false } }), sequence: ++this.sequence },
            });
            assertOk(resp, 'feishu close stream');
        }
        catch (error) {
            // Auto-closes after 10 minutes anyway; not worth failing the turn over.
            this.log(`feishu 关闭流式模式失败（10 分钟后自动关闭）: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async patchCard(messageId, content) {
        const resp = await this.client.im.v1.message.patch({
            path: { message_id: messageId },
            data: { content: markdownCard(content) },
        });
        assertOk(resp, 'feishu patch card');
    }
    async editText(messageId, text) {
        const resp = await this.client.im.v1.message.update({
            path: { message_id: messageId },
            data: { msg_type: 'text', content: JSON.stringify({ text }) },
        });
        assertOk(resp, 'feishu update text');
    }
    async createCard(content) {
        const resp = await this.client.im.v1.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: this.target.targetId, msg_type: 'interactive', content: markdownCard(content) },
        });
        assertOk(resp, 'feishu create card');
    }
    async createText(text) {
        const resp = await this.client.im.v1.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: this.target.targetId, msg_type: 'text', content: JSON.stringify({ text }) },
        });
        assertOk(resp, 'feishu create text');
    }
    /** Last-resort delivery honoring the markdown flag with card→text degrade. */
    async sendFinalRaw(final) {
        const text = final.text.length > TEXT_CHUNK_LIMIT ? `${final.text.slice(0, TEXT_CHUNK_LIMIT - 1)}…` : final.text;
        if (final.markdown === true) {
            try {
                await this.createCard(final.text.length > CARD_CHUNK_LIMIT ? `${final.text.slice(0, CARD_CHUNK_LIMIT - 1)}…` : final.text);
                return;
            }
            catch {
                // fall through to text
            }
        }
        await this.createText(text);
    }
}
/** Build a CardKit streaming-card JSON (schema 2.0) around one markdown block. */
function streamingCard(content) {
    return JSON.stringify({
        schema: '2.0',
        config: {
            streaming_mode: true,
            streaming_config: {
                print_frequency_ms: { default: 50 },
                print_step: { default: 2 },
                print_strategy: 'fast',
            },
            update_multi: true,
        },
        body: { elements: [{ tag: 'markdown', content, element_id: STREAM_ELEMENT_ID }] },
    });
}
/** Build an interactive-card payload rendering one markdown block. */
function markdownCard(content) {
    return JSON.stringify({
        config: { wide_screen_mode: true },
        elements: [{ tag: 'markdown', content }],
    });
}
/** Feishu API responses carry code/msg; nonzero code is a failed call. */
function assertOk(resp, what) {
    if (resp !== undefined && resp.code !== undefined && resp.code !== 0) {
        throw new Error(`${what} code=${resp.code} ${resp.msg ?? ''}`);
    }
}
/** Keep the tail of an over-long live view, with a truncation marker. */
function capView(view, cap) {
    if (view.length <= cap)
        return view;
    return `…\n${view.slice(view.length - cap + 2)}`;
}
/** Split long final content on newline boundaries near the limit. */
function splitForBoundary(text, limit) {
    if (text.length <= limit)
        return [text];
    const chunks = [];
    let rest = text;
    while (rest.length > limit) {
        let cut = rest.lastIndexOf('\n', limit);
        if (cut < limit / 2)
            cut = limit;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    if (rest.length > 0)
        chunks.push(rest);
    return chunks;
}
