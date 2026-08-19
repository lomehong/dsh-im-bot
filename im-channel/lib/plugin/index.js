import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import z from '@deepseek-ai/schemastery';
import { BindStore } from "../core/bind-store.js";
import { Router } from "../core/router.js";
import { DEFAULT_GUEST_COMMANDS } from "../core/guest-permissions.js";
import { HarnessDriver } from "./driver.js";
import { WechatChannel, loadWechatCredentials } from "../channels/wechat/index.js";
import { FeishuChannel, loadFeishuCredentials } from "../channels/feishu/index.js";
import { WecomChannel, loadWecomCredentials } from "../channels/wecom/index.js";
import { WecomMcpRegistry } from "../channels/wecom/wecom-mcp-registry.js";
import { getEnabledMcpServers } from "../channels/mcp-server-manager.js";
import { LoginApi } from "./login-api.js";
import { ApprovalBridge } from "./approval-bridge.js";
export const name = 'im-channel';
export const inject = ['agents'];
export const provide = ['im-channel'];
const NS = settingsNamespace('im-channel');
const KindUnion = z.union(['feishu', 'wechat', 'wecom']);
const InstanceSchema = z.object({
    kind: KindUnion,
    enabled: z.boolean().default(true),
    displayName: z.string().default(''),
});
export const Config = z.object({
    channels: z.dict(InstanceSchema).default({}),
    commandPrefix: z.string().default('/'),
    allowlist: z.array(z.string()).default([]),
    guestTools: z.array(z.string()).default([]),
    guestCommands: z.array(z.string()).default([...DEFAULT_GUEST_COMMANDS]),
});
function isCredentialled(kind) {
    switch (kind) {
        case 'wechat': return loadWechatCredentials() !== undefined;
        case 'feishu': return loadFeishuCredentials() !== undefined;
        case 'wecom': return loadWecomCredentials() !== undefined;
    }
}
/** Build one channel instance from its declared config. */
function buildChannel(kind, ctx) {
    const log = (line) => { ctx.logger.info(line); };
    switch (kind) {
        case 'wechat': return new WechatChannel({ ctxLog: log });
        case 'feishu': return new FeishuChannel({ log });
        case 'wecom': return new WecomChannel({ log });
    }
}
export function apply(ctx, config) {
    // Browser-facing login routes: /im-channel/login/start and /status.
    ctx.inject(['webServer'], (wctx) => {
        new LoginApi(wctx).register();
    });
    let current = config;
    let router;
    let disposeRouter;
    ctx.provide('im-channel', {
        /**
         * 主动推送一条消息给指定渠道用户（须已绑定且记录过 lastTargetId）。
         * @returns 是否成功投递
         */
        pushToUser: (kind, userId, text, options) => {
            const r = router;
            if (r === undefined)
                return Promise.resolve(false);
            return r.pushToUser(kind, userId, text, options);
        },
    });
    // One driver for the whole plugin lifetime: router rebuilds (settings
    // edits, instance reconciliation) must not orphan bound sessions — the
    // driver's owned-session map is what /bind hands out.
    const mcpRegistry = new WecomMcpRegistry();
    // 从通用 MCP 服务器管理中读取所有已启用的 MCP 服务器
    const enabledServers = getEnabledMcpServers();
    for (const server of enabledServers) {
        mcpRegistry.registerServer({ name: server.name, url: server.url });
    }
    // 访客工具审批桥：卡片推给渠道 Owner，等待其 IM 回复（允许/拒绝），
    // 超时 fail-closed。通知走当前 router 的 pushToUser（闭包延迟绑定）。
    // 审批卡片走渠道能力（飞书 interactive / 企微 template_card），
    // 按钮经同一条长连接回传；文本兜底只在卡片不可达时使用。
    const ownerTargetOf = (kind, ownerUserId) => {
        const targetId = store.targetIdFor({ kind: kind, userId: ownerUserId });
        return targetId === undefined ? undefined : { kind: kind, targetId };
    };
    const channelOf = (kind) => router?.channels.find(c => c.kind === kind);
    const approvalBridge = new ApprovalBridge((kind, ownerUserId, body) => {
        const r = router;
        if (r === undefined)
            return Promise.resolve(false);
        return r.pushToUser(kind, ownerUserId, body, { markdown: false });
    }, async (kind, ownerUserId, card) => {
        const channel = channelOf(kind);
        const target = ownerTargetOf(kind, ownerUserId);
        if (channel?.sendApprovalCard === undefined || target === undefined)
            return false;
        try {
            return await channel.sendApprovalCard(target, { ...card, reason: card.reason });
        }
        catch {
            return false;
        }
    }, line => { ctx.logger.info(`[im-channel] ${line}`); });
    const driver = new HarnessDriver(ctx, {
        mcpRegistry,
        guestTools: () => current.guestTools ?? [],
        // 非本插件驱动轮次的产出（schedule 提醒、yuyi 唤醒、竞态尾巴）
        // 主动推送到该会话绑定用户的 IM——网页端看得到的，手机上也看得到。
        onBackgroundMessage: (sessionId, messageText) => {
            const row = store.findBySession(sessionId);
            if (row === undefined)
                return;
            const r = router;
            if (r === undefined)
                return;
            void r.pushToUser(row.kind, row.userId, messageText, { markdown: true }).then(delivered => {
                if (!delivered)
                    ctx.logger.info(`[im-channel] 后台响应推送失败：${row.kind} ${row.userId.slice(0, 8)}… 无可达目标`);
            });
        },
        onOwnerApproval: ({ sessionId, toolName, reason, guestUserId }) => {
            const row = store.findBySession(sessionId);
            if (row === undefined)
                return Promise.resolve('rejected');
            const owner = store.ownerFor(row.kind);
            if (owner === undefined)
                return Promise.resolve('rejected');
            const label = guestUserId === undefined || guestUserId === 'unknown' ? row.userId.slice(0, 10) + '…' : guestUserId.slice(0, 16);
            return approvalBridge.request(row.kind, owner.userId, label, { toolName, reason });
        },
    });
    // One bind store for the whole plugin lifetime (and process-shared with
    // the login HTTP API): the bound-session rows must survive router
    // rebuilds, and /bind hands out new sessions from it.
    const store = BindStore.shared;
    installSettingsSection(ctx, NS, Config, config, {
        setSource: (source) => { current = source(); },
        onChange: () => {
            // Reconcile the live router against the declared instances: a changed
            // set, kind, or enabled flag restarts the router wholesale — channel
            // connections are cheap to re-establish relative to config edits.
            const next = current;
            // A platform with saved credentials but no declared instance (e.g.
            // credentials persisted before this reconciliation existed, or settings
            // storage was reset) gets an auto-created instance so the bot actually
            // comes online after login. The settings service is optional at the
            // composition level, so reach it through a scoped inject.
            ctx.inject(['settings'], sctx => {
                void ensureInstancesForCredentials(sctx, next).catch(() => { });
            });
            if (router !== undefined && sameTopology(router, next))
                return;
            disposeRouter?.();
            router = undefined;
            const channels = [];
            for (const [name, instance] of Object.entries(next.channels)) {
                if (!instance.enabled)
                    continue;
                if (!isCredentialled(instance.kind)) {
                    ctx.logger.warn(`im-channel: 实例 ${name}（${instance.kind}）缺少登录凭证，跳过；请先完成该平台的登录/配置`);
                    continue;
                }
                const channel = buildChannel(instance.kind, ctx);
                channels.push(channel);
            }
            if (channels.length === 0)
                return;
            router = new Router({
                channels,
                driver,
                store,
                config: { commandPrefix: next.commandPrefix },
                log: (line) => { ctx.logger.info(line); },
                allowed: (from) => {
                    const list = current.allowlist;
                    if (list === undefined || list.length === 0)
                        return true;
                    return list.includes(from.userId) || list.includes(`${from.kind}:${from.userId}`);
                },
                guestCommands: () => current.guestCommands ?? DEFAULT_GUEST_COMMANDS,
                approval: {
                    consumeOwnerReply: (kind, ownerUserId, messageText) => approvalBridge.consumeOwnerReply(kind, ownerUserId, messageText),
                    resolveByToken: (kind, token, decision, userId, settleCard) => approvalBridge.resolveByToken(kind, token, decision, userId, settleCard),
                },
                usageOf: sessionId => driver.usageOf(sessionId),
                compact: sessionId => driver.compact(sessionId),
                status: () => {
                    const selection = ctx.get('agentDefaultModel');
                    if (selection !== undefined) {
                        const value = selection.currentSelection();
                        const facts = { cwd: process.cwd(), provider: value.provider, model: value.model };
                        if (value.reasoningEffort !== undefined)
                            facts.reasoningEffort = value.reasoningEffort;
                        return facts;
                    }
                    return { cwd: process.cwd(), provider: '-', model: '-' };
                },
                workspaces: () => {
                    const registry = ctx.get('workspaceRegistry');
                    if (registry === undefined)
                        return [];
                    return registry.list().map((w) => ({ path: w.path, title: w.title }));
                },
                models: async () => {
                    const llm = ctx.get('llm');
                    if (llm === undefined)
                        return [];
                    const choices = [];
                    for (const provider of llm.listProviders()) {
                        try {
                            const models = await llm.listModels(provider.id);
                            for (const m of models)
                                choices.push({ provider: provider.id, model: m.id, label: m.id });
                        }
                        catch {
                            // Provider without a discoverable catalog is skipped.
                        }
                    }
                    return choices;
                },
                cancel: sessionId => driver.cancel(sessionId),
                efforts: async () => {
                    const llm = ctx.get('llm');
                    const selection = ctx.get('agentDefaultModel');
                    if (llm === undefined || selection === undefined)
                        return [];
                    const value = selection.currentSelection();
                    if (value.provider === '' || value.model === '')
                        return [];
                    try {
                        const info = await llm.resolveModelInfo(value.provider, value.model);
                        return info.reasoning?.efforts.map(e => ({ id: e.id, name: e.name })) ?? [];
                    }
                    catch {
                        return [];
                    }
                },
                setDefaultModel: async (patch) => {
                    const service = ctx.get('agentDefaultModel');
                    if (service === undefined)
                        throw new Error('agentDefaultModel 服务不可用');
                    const current = service.currentSelection();
                    await service.saveSelection({
                        provider: patch.provider ?? current.provider,
                        model: patch.model ?? current.model,
                        ...patch.reasoningEffort === undefined && current.reasoningEffort === undefined
                            ? {}
                            : { reasoningEffort: patch.reasoningEffort ?? current.reasoningEffort },
                    });
                },
            });
            void ctx.effect(async function* () {
                await router?.start();
                yield () => { void router?.stop(); };
            }, 'im-channel.router');
            disposeRouter = () => { void router?.stop(); router = undefined; };
        },
    });
}
/** Whether the live router already serves exactly this topology. */
function sameTopology(router, next) {
    const live = router.channels;
    const wanted = Object.entries(next.channels)
        .filter(([, instance]) => instance.enabled)
        .map(([, instance]) => instance.kind)
        .sort();
    const liveKinds = live.map(channel => channel.kind).sort();
    return liveKinds.length === wanted.length && liveKinds.every((kind, index) => kind === wanted[index]);
}
/** Auto-create instances for platforms that have credentials but no row. */
async function ensureInstancesForCredentials(ctx, next) {
    const KIND_LABELS = { wechat: '微信', feishu: '飞书', wecom: '企业微信' };
    const patch = {};
    let changed = false;
    for (const kind of ['wechat', 'feishu', 'wecom']) {
        if (!isCredentialled(kind))
            continue;
        const sameKind = Object.entries(next.channels).filter(([, v]) => v.kind === kind);
        if (sameKind.length > 0)
            continue;
        const name = `${kind}-1`;
        patch[name] = { kind, enabled: true, displayName: `${KIND_LABELS[kind]}机器人 1` };
        changed = true;
    }
    if (!changed)
        return;
    try {
        await ctx.settings.update(NS, { channels: patch });
    }
    catch (error) {
        ctx.logger.warn(`im-channel: 为已登录平台自动创建实例失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
