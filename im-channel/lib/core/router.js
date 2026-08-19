import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { modeOf } from "./render.js";
import { DEFAULT_GUEST_COMMANDS } from "./guest-permissions.js";
export class Router {
    deps;
    commandPrefix;
    /** Start a session honoring the user's stored workspace, if any. */
    startUserSession(from) {
        const options = {
            userId: from.userId,
            isMaster: this.deps.store.isMasterFor?.(from) ?? false,
        };
        const cwd = this.deps.store.workspaceFor?.(from);
        if (cwd !== undefined)
            options.cwd = cwd;
        return this.deps.driver.startSession(options);
    }
    /** The wired channels (readonly view for topology reconciliation). */
    channels;
    constructor(deps) {
        this.deps = deps;
        this.commandPrefix = deps.config?.commandPrefix ?? '/';
        this.channels = deps.channels;
    }
    log(line) {
        this.deps.log?.(line);
    }
    /** Wire all channels' inbound handlers to routeMessage and connect them. */
    async start() {
        // Connect channels independently: one platform being down must not stop
        // the others from listening, and failures surface as logs, not rejects.
        await Promise.all(this.deps.channels.map(async (channel) => {
            if (!channel.isConfigured())
                return;
            channel.onMessage(message => {
                void this.routeMessage(channel, message);
            });
            channel.onDead?.(reason => {
                this.log(`[im-channel] ⚠️ ${channel.label} 渠道已掉线：${reason}`);
            });
            try {
                await channel.connect();
            }
            catch (error) {
                this.log(`[im-channel] ${channel.label} 渠道连接失败: ${messageOf(error)}`);
            }
        }));
    }
    async stop() {
        await Promise.all(this.deps.channels.map(async (channel) => channel.stop()));
    }
    /** channel.send that can never reject into an unhandled rejection. */
    async safeSend(channel, target, message) {
        try {
            await channel.send(target, message);
        }
        catch (error) {
            this.log(`[im-channel] ${channel.label} 发送到 ${target.targetId.slice(0, 12)}… 失败: ${messageOf(error)}`);
        }
    }
    /**
     * 主动向某个渠道用户推送一条消息（不等用户输入）。
     * 用于：其他通道（如御驿/yuyi）收到的重要消息转推给 Owner；
     * agent 主动汇报等场景。用户须已绑定且记录过 lastTargetId。
     * 返回是否成功投递；目标不可达时返回 false（不抛错）。
     */
    async pushToUser(kind, userId, text, options = {}) {
        const channel = this.deps.channels.find(c => c.kind === kind);
        if (channel === undefined) {
            this.log(`[im-channel] pushToUser: 渠道 ${kind} 未连接，跳过推送`);
            return false;
        }
        const ref = { kind, userId: userId };
        const targetId = this.deps.store.targetIdFor?.(ref);
        if (targetId === undefined) {
            this.log(`[im-channel] pushToUser: ${kind}:${userId.slice(0, 12)}… 无 lastTargetId，无法主动推送`);
            return false;
        }
        await this.safeSend(channel, { kind, targetId }, { text, markdown: options.markdown ?? true });
        return true;
    }
    /** Open a live turn sink, falling back to send-on-final when unsupported. */
    async openSink(channel, target, mode) {
        if (channel.openTurn !== undefined) {
            try {
                return await channel.openTurn(target, { mode });
            }
            catch (error) {
                this.log(`[im-channel] ${channel.label} 打开流式回复失败，退回最终一次性发送: ${messageOf(error)}`);
            }
        }
        return {
            update: () => { },
            finish: async (final) => { await this.safeSend(channel, target, final); },
            fail: async (text) => { await this.safeSend(channel, target, { text }); },
        };
    }
    /** Route one inbound message: commands first, then bound-session chat. */
    async routeMessage(channel, message) {
        const target = { kind: channel.kind, targetId: message.chatId ?? message.from.userId };
        try {
            if (this.deps.allowed !== undefined && !this.deps.allowed(message.from)) {
                this.log(`[im-channel] ${channel.label} 拒绝未授权用户 ${message.from.userId.slice(0, 12)}…`);
                return;
            }
            // Owner 的「允许/拒绝」回复优先于一切路由：有待审批请求时作为决策消费。
            if (this.deps.approval !== undefined) {
                const approvalOwner = this.deps.store.ownerFor?.(message.from.kind);
                if (approvalOwner !== undefined && approvalOwner.userId === message.from.userId
                    && this.deps.approval.consumeOwnerReply(message.from.kind, approvalOwner.userId, message.text)) {
                    return;
                }
            }
            if (message.text.startsWith(this.commandPrefix)) {
                await this.runCommand(channel, target, message);
                return;
            }
            // 数字分身模型：渠道内第一个 /bind 的用户是 Owner，其会话是分身本体；
            // 其他所有人都是访客，每个访客拥有独立的会话，互不干扰。
            // 所有会话共享记忆（通过 dsh-memory 插件）。
            const owner = this.deps.store.ownerFor?.(message.from.kind);
            if (owner === undefined) {
                await this.safeSend(channel, target, {
                    text: '🤖 机器人尚未初始化。请 Owner 发送 /bind 认领并选择工作区；认领后所有人即可直接对话。',
                });
                return;
            }
            const isOwner = owner.userId === message.from.userId;
            this.deps.store.rememberTarget?.(message.from, target.targetId);
            if (!isOwner) {
                // 访客独立会话模型：每个访客拥有自己的会话，不共享会话上下文
                let guestSessionId = this.deps.store.sessionIdFor(message.from);
                if (guestSessionId === undefined) {
                    // 首次对话，创建新会话
                    guestSessionId = await this.startUserSession(message.from);
                    this.deps.store.bind(message.from, guestSessionId, false);
                    this.log(`[im-channel] 访客 ${message.from.userId.slice(0, 12)}… 创建独立会话 ${guestSessionId.slice(0, 8)}…`);
                }
                await this.promptSession(channel, target, message, guestSessionId, false, message.from.userId);
                return;
            }
            await this.promptAvatarSession(channel, target, message, owner, isOwner);
        }
        catch (error) {
            // 顶层兜底：会话创建/路由失败不得变成 unhandled rejection，
            // 也尽量给用户一个可理解的提示而不是静默吞掉。
            this.log(`[im-channel] ${channel.label} 处理消息失败: ${messageOf(error)}`);
            await this.safeSend(channel, target, { text: `⚠️ 处理消息时出错：${messageOf(error)}` }).catch(() => { });
        }
    }
    /**
     * Prompt the owner's avatar session (resuming it after host restarts) and
     * stream the reply back, whether the actor is the owner or a guest.
     */
    async promptAvatarSession(channel, target, message, owner, isOwner) {
        let sessionId = owner.sessionId;
        // Bindings outlive the process; the driver's owned map does not. Lazily
        // re-attach before prompting so a host restart does not force a /bind.
        if (this.deps.driver.has !== undefined && !this.deps.driver.has(sessionId)) {
            const ownerRef = { kind: message.from.kind, userId: owner.userId };
            const cwd = this.deps.store.workspaceFor?.(ownerRef);
            try {
                const resumeOpts = { userId: owner.userId, isMaster: true };
                if (cwd !== undefined)
                    resumeOpts.cwd = cwd;
                await this.deps.driver.resumeSession?.(sessionId, resumeOpts);
                this.log(`[im-channel] 分身会话 ${sessionId.slice(0, 8)}… 重连成功`);
            }
            catch (error) {
                // 分身本体不在了（重启且恢复失败）：为 Owner 重建会话并更新锚点，
                // 访客随锚点自动跟随，无需各自处理。
                this.log(`[im-channel] 分身会话 ${sessionId.slice(0, 8)}… 重连失败，重建: ${messageOf(error)}`);
                const newSessionId = await this.startUserSession(ownerRef);
                this.deps.store.bind(ownerRef, newSessionId, true);
                sessionId = newSessionId;
            }
        }
        await this.handleBoundMessage(channel, target, message, sessionId, isOwner);
    }
    /**
     * Prompt a guest session (resuming after host restart) and stream the reply.
     * Each guest has their own independent session.
     */
    async promptSession(channel, target, message, sessionId, _isMaster, userId) {
        // Resume session after host restart
        if (this.deps.driver.has !== undefined && !this.deps.driver.has(sessionId)) {
            try {
                await this.deps.driver.resumeSession?.(sessionId, { userId, isMaster: false });
                this.log(`[im-channel] 访客会话 ${sessionId.slice(0, 8)}… 重连成功`);
            }
            catch (error) {
                this.log(`[im-channel] 访客会话 ${sessionId.slice(0, 8)}… 重连失败，重建: ${messageOf(error)}`);
                const newSessionId = await this.startUserSession(message.from);
                this.deps.store.bind(message.from, newSessionId, false);
                sessionId = newSessionId;
            }
        }
        await this.handleBoundMessage(channel, target, message, sessionId, false);
    }
    /** 处理已绑定的会话消息：发送到 agent 并回复 */
    async handleBoundMessage(channel, target, message, sessionId, isMaster = false) {
        const verbosity = this.deps.store.verbosityFor?.(message.from);
        const sink = await this.openSink(channel, target, modeOf(verbosity));
        try {
            const promptOptions = { actor: isMaster ? 'owner' : 'guest', userId: message.from.userId, isMaster };
            if (verbosity !== undefined)
                promptOptions.verbosity = verbosity;
            promptOptions.onUpdate = view => sink.update(view);
            // 在消息前注入用户身份，让 agent 知道在和谁对话
            const label = isMaster ? '主人' : '访客';
            const userInfo = message.userInfo;
            const displayName = userInfo?.name ?? userInfo?.userId ?? message.from.userId;
            const position = userInfo?.position ?? '';
            const department = userInfo?.department?.join('、') ?? '';
            const identitySeg = [label, displayName, position, department].filter(Boolean).join('·');
            const enrichedText = `[${identitySeg}] ${message.text}`;
            let usageTokens = 0;
            promptOptions.onMeta = meta => { usageTokens = meta.usageTokens; };
            const reply = await this.deps.driver.prompt(sessionId, enrichedText, promptOptions);
            let finalText = usageTokens > 0 ? `${reply}${FOOTER_SEP}${formatTokens(usageTokens)} tokens` : reply;
            const spilled = spillIfLong(finalText);
            if (spilled.locator !== undefined) {
                this.log(`[im-channel] 长回复落盘 ${spilled.locator}（${finalText.length} 字符）`);
                finalText = spilled.text;
            }
            await sink.finish({ text: finalText, markdown: true });
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            await sink.fail(`⚠️ ${text}`);
        }
    }
    /** Handle slash commands (Chinese primary, English aliases). */
    async runCommand(channel, target, message) {
        const [rawCommand, ...args] = message.text.slice(this.commandPrefix.length).trim().split(/\s+/);
        const command = COMMAND_ALIASES[rawCommand] ?? rawCommand;
        // 命令门禁：Owner 全量；访客仅限 guestCommands；未认领渠道仅 bind 放行。
        const owner = this.deps.store.ownerFor?.(message.from.kind);
        const isOwner = owner !== undefined && owner.userId === message.from.userId;
        const ownerOnly = new Set(['bind', 'project', 'model', 'think', 'new', 'unbind', 'mode', 'compact']);
        if (!isOwner && ownerOnly.has(command)) {
            if (command === 'bind' && owner === undefined) {
                // 未认领渠道：任何人的 /bind 都是认领动作，放行到下方处理。
            }
            else if (command === 'bind') {
                await this.safeSend(channel, target, { text: '🔒 本机器人已由 Owner 绑定。如需交接，请 Owner 发送 /unbind 后再重新认领。' });
                return;
            }
            else if (owner === undefined) {
                await this.safeSend(channel, target, { text: '🤖 机器人尚未初始化。请 Owner 先发送 /bind 认领。' });
                return;
            }
            else {
                await this.safeSend(channel, target, { text: '🔒 该命令仅 Owner 可用。' });
                return;
            }
        }
        if (!isOwner && owner !== undefined) {
            const allowed = new Set(this.deps.guestCommands?.() ?? DEFAULT_GUEST_COMMANDS);
            if (!allowed.has(command) && !allowed.has(rawCommand)) {
                await this.safeSend(channel, target, { text: '🔒 该命令仅 Owner 可用。发送 /帮助 查看可用命令。' });
                return;
            }
            // 访客命令：使用访客自己的独立会话
            if (this.deps.store.sessionIdFor(message.from) === undefined) {
                const guestSessionId = await this.startUserSession(message.from);
                this.deps.store.bind(message.from, guestSessionId, false);
                this.deps.store.rememberTarget?.(message.from, target.targetId);
            }
        }
        switch (command) {
            case 'bind': {
                // 认领本渠道的数字分身：创建 Owner 会话并成为唯一管理者。
                const sessionId = await this.startUserSession(message.from);
                this.deps.store.bind(message.from, sessionId, true);
                this.deps.store.rememberTarget?.(message.from, target.targetId);
                const workspace = this.deps.store.workspaceFor?.(message.from);
                const lead = workspace === undefined
                    ? '✅ 认领成功，你已成为本机器人的 Owner。请发送 /项目 选择工作区；之后所有人无需绑定即可直接与你的数字分身对话。'
                    : `✅ 认领成功，你已成为本机器人的 Owner。当前项目：${workspace}。其他人现在就可以直接对话；访客可用的命令/工具可在网页设置 → 手机连接 → 访客权限中调整。`;
                await this.safeSend(channel, target, { text: `${lead}\n\n${COMMAND_LIST}` });
                return;
            }
            case 'unbind': {
                const removed = this.deps.store.unbind(message.from);
                await this.safeSend(channel, target, { text: removed ? '已解除认领。分身已下线，下一个 /bind 的人将成为新 Owner。' : '当前没有绑定。' });
                return;
            }
            case 'help': {
                await this.safeSend(channel, target, { text: COMMAND_LIST });
                return;
            }
            case 'status': {
                const avatar = this.deps.store.ownerFor?.(message.from.kind);
                if (avatar === undefined) {
                    await this.safeSend(channel, target, { text: '机器人尚未初始化。请 Owner 发送 /bind 认领。' });
                    return;
                }
                const facts = this.deps.status?.();
                const sessionId = this.deps.store.sessionIdFor(message.from) ?? avatar.sessionId;
                const lines = ['📊 当前状态', '──────────────────'];
                if (facts !== undefined) {
                    lines.push(`工作区：${facts.cwd}`);
                    lines.push(`模型：${facts.model}（${facts.provider}）`);
                    if (facts.reasoningEffort !== undefined)
                        lines.push(`思考：${facts.reasoningEffort}`);
                }
                lines.push(`会话：${sessionId.slice(0, 8)}…`);
                lines.push(`你的身份：${avatar.userId === message.from.userId ? 'Owner' : '访客'}`);
                const usage = this.deps.usageOf?.(sessionId);
                if (usage !== undefined)
                    lines.push(`上下文：约 ${formatTokens(usage.totalTokens)} tokens`);
                await this.safeSend(channel, target, { text: lines.join('\n') });
                return;
            }
            case 'new': {
                if (this.deps.store.sessionIdFor(message.from) === undefined) {
                    await this.safeSend(channel, target, { text: '还没有绑定。先发送 /bind。' });
                    return;
                }
                const sessionId = await this.startUserSession(message.from);
                this.deps.store.bind(message.from, sessionId);
                await this.safeSend(channel, target, { text: `🆕 已开始新会话 ${sessionId.slice(0, 8)}…。上下文已清空，直接发消息开始新任务。` });
                return;
            }
            case 'model': {
                const facts = this.deps.status;
                if (facts === undefined || this.deps.setDefaultModel === undefined) {
                    await this.safeSend(channel, target, { text: '当前模型切换不可用。' });
                    return;
                }
                const current = facts();
                if (args.length === 0) {
                    const list = await this.deps.models?.() ?? [];
                    if (list.length === 0) {
                        await this.safeSend(channel, target, { text: `🤖 当前模型：${current.model}（${current.provider}）\n──────────────────\n发送 /模型 <模型id> 或 /模型 <provider>/<模型id> 切换。` });
                        return;
                    }
                    const lines = [`🤖 当前模型：${current.model}（${current.provider}）`, '──────────────────', '可选模型：'];
                    list.forEach((m, i) => { lines.push(`${i + 1}. ${m.label}${m.model === current.model ? ' ⬅ 当前' : ''}`); });
                    lines.push('──────────────────');
                    lines.push('发送 /模型 N 选择。');
                    await this.safeSend(channel, target, { text: lines.join('\n') });
                    return;
                }
                const list = await this.deps.models?.() ?? [];
                const rawArg = args[0] ?? '';
                const choice = Number.parseInt(rawArg, 10);
                const picked = Number.isInteger(choice) && choice >= 1 && choice <= list.length
                    ? list[choice - 1]
                    : rawArg.includes('/')
                        ? (() => { const [provider, model] = rawArg.split('/'); return { provider: provider ?? '', model: model ?? rawArg, label: model ?? rawArg }; })()
                        : { provider: current.provider, model: rawArg, label: rawArg };
                await this.deps.setDefaultModel({ provider: picked.provider, model: picked.model });
                await this.safeSend(channel, target, { text: `✅ 模型已切换：${picked.model}（${picked.provider}）。发送 /新建 后生效。` });
                return;
            }
            case 'stop': {
                // 访客独立会话模型下，谁按停就停谁的会话：
                // 访客停自己的独立会话，Owner 停分身会话。
                const avatar = this.deps.store.ownerFor?.(message.from.kind);
                if (avatar === undefined) {
                    await this.safeSend(channel, target, { text: '机器人尚未初始化。请 Owner 发送 /bind 认领。' });
                    return;
                }
                const sessionId = this.deps.store.sessionIdFor(message.from) ?? avatar.sessionId;
                const stopped = this.deps.cancel?.(sessionId) ?? false;
                await this.safeSend(channel, target, { text: stopped ? '⏹ 已停止当前任务。' : '当前没有正在执行的任务。' });
                return;
            }
            case 'think': {
                const facts = this.deps.status;
                if (facts === undefined || this.deps.setDefaultModel === undefined) {
                    await this.safeSend(channel, target, { text: '思考级别切换不可用。' });
                    return;
                }
                const current = facts();
                const levels = await this.deps.efforts?.() ?? [];
                if (levels.length === 0) {
                    await this.safeSend(channel, target, { text: '当前模型不支持思考级别切换。' });
                    return;
                }
                const currentName = levels.find(l => l.id === current.reasoningEffort)?.name ?? current.reasoningEffort ?? '默认';
                const header = `🧠 思考级别：${currentName}`;
                const list = levels.map((l, i) => {
                    const mark = l.id === current.reasoningEffort ? ' ⬅ 当前' : '';
                    return `${i + 1}. ${l.name}${mark}`;
                });
                if (args.length === 0) {
                    await this.safeSend(channel, target, { text: [header, '──────────────────', ...list, '──────────────────', '发送 /思考 N 选择。'].join('\n') });
                    return;
                }
                const rawArg = args[0] ?? '';
                const choice = Number.parseInt(rawArg, 10);
                const picked = Number.isInteger(choice) && choice >= 1 && choice <= levels.length
                    ? levels[choice - 1]
                    : levels.find(l => l.id === rawArg || l.name.toLowerCase() === rawArg.toLowerCase());
                if (picked === undefined) {
                    await this.safeSend(channel, target, { text: [header, '──────────────────', ...list, '──────────────────', `无效选择 ${rawArg}。发送 /思考 N 选择。`].join('\n') });
                    return;
                }
                await this.deps.setDefaultModel({ reasoningEffort: picked.id });
                await this.safeSend(channel, target, { text: `✅ 思考级别已切换：${picked.name}` });
                return;
            }
            case 'project': {
                const facts = this.deps.status?.();
                const list = this.deps.workspaces?.() ?? [];
                if (args.length === 0) {
                    if (list.length === 0) {
                        await this.safeSend(channel, target, { text: `📁 当前工作区：${facts?.cwd ?? process.cwd()}\n──────────────────\n暂无其他可选项目。` });
                        return;
                    }
                    const lines = [`📁 当前工作区：${facts?.cwd ?? process.cwd()}`, '──────────────────', '可选项目：'];
                    list.forEach((w, i) => { lines.push(`${i + 1}. ${w.title || w.path}`); });
                    lines.push('──────────────────');
                    lines.push('发送 /项目 N 切换（将开启新线程）。');
                    await this.safeSend(channel, target, { text: lines.join('\n') });
                    return;
                }
                const rawArg = args[0] ?? '';
                const choice = Number.parseInt(rawArg, 10);
                const picked = Number.isInteger(choice) && choice >= 1 && choice <= list.length
                    ? list[choice - 1]
                    : list.find(w => w.path === rawArg || w.title === args.join(' '));
                if (picked === undefined) {
                    await this.safeSend(channel, target, { text: `无效选择。发送 /项目 查看列表。` });
                    return;
                }
                this.deps.store.selectWorkspace?.(message.from, picked.path);
                const sessionId = await this.deps.driver.startSession({ cwd: picked.path });
                this.deps.store.bind(message.from, sessionId);
                await this.safeSend(channel, target, { text: `✅ 已切换项目：${picked.title || picked.path}\n🆕 新线程已开启，直接发消息开始。` });
                return;
            }
            case 'fulltext': {
                const locator = (args[0] ?? '').trim();
                if (!/^[a-z0-9]{4,12}$/.test(locator)) {
                    await this.safeSend(channel, target, { text: '用法：/全文 <编号>。编号见长回复末尾的提示。' });
                    return;
                }
                const content = readSpill(locator);
                if (content === undefined) {
                    await this.safeSend(channel, target, { text: `未找到编号 ${locator} 的全文（可能已过期）。` });
                    return;
                }
                await this.safeSend(channel, target, { text: content });
                return;
            }
            case 'compact': {
                const avatarSession = this.deps.store.ownerFor?.(message.from.kind);
                if (avatarSession === undefined) {
                    await this.safeSend(channel, target, { text: '机器人尚未初始化。' });
                    return;
                }
                if (this.deps.compact === undefined) {
                    await this.safeSend(channel, target, { text: '压缩服务不可用。' });
                    return;
                }
                await this.safeSend(channel, target, { text: '⏳ 正在压缩会话上下文…' });
                const compacted = await this.deps.compact(avatarSession.sessionId);
                await this.safeSend(channel, target, { text: compacted ? '✅ 压缩完成，历史要点已保留。' : '⚠️ 本次未执行压缩（可能尚不需要）。' });
                return;
            }
            case 'mode': {
                await this.safeSend(channel, target, { text: '模式切换即将上线。' });
                return;
            }
            case 'reply': {
                const levels = ['简洁', '标准', '详细'];
                const descriptions = {
                    简洁: '只发最后一条 AI 消息',
                    标准: '边生成边推送全部 AI 文字',
                    详细: '边生成边推送工具调用过程 + 全部 AI 消息',
                };
                const current = this.deps.store.verbosityFor?.(message.from) ?? '标准';
                const list = levels.map((name, i) => {
                    const mark = name === current ? ' ⬅ 当前' : '';
                    return `${i + 1}. ${name} — ${descriptions[name]}${mark}`;
                });
                const requested = args[0];
                const asNumber = Number.parseInt(requested ?? '', 10);
                let picked;
                if (requested !== undefined && levels.includes(requested)) {
                    picked = requested;
                }
                else if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= levels.length) {
                    picked = levels[asNumber - 1];
                }
                if (picked !== undefined) {
                    this.deps.store.setVerbosity?.(message.from, picked);
                }
                else if (requested !== undefined) {
                    await this.safeSend(channel, target, { text: [`💬 回复详细程度`, '──────────────────', ...list, '──────────────────', `无效选择 ${requested}。发送 /回复 N 或 /回复 <级别名> 设置。`].join('\n') });
                    return;
                }
                else {
                    picked = levels[(levels.indexOf(current) + 1) % levels.length] ?? '标准';
                    this.deps.store.setVerbosity?.(message.from, picked);
                }
                await this.safeSend(channel, target, {
                    text: `✅ 回复详细程度：${picked}\n（${descriptions[picked]}）\n──────────────────\n${list.join('\n')}\n──────────────────\n发送 /回复 N 直接指定，不带参数则轮换切换。`,
                });
                return;
            }
            default:
                await this.safeSend(channel, target, { text: `⚠️ 未知命令 /${rawCommand}。\n\n${COMMAND_LIST}` });
        }
    }
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
/** Token footer: blank line + rule + coin + usage. */
const FOOTER_SEP = '\n\n──────────\n🪙 本轮约 ';
/** Replies beyond this length spill to disk and ship a head/tail preview. */
const SPILL_THRESHOLD = 6_000;
const SPILL_HEAD = 2_800;
const SPILL_TAIL = 1_200;
function spillsDir() {
    return process.env.IM_CHANNEL_SPILL_DIR ?? join(homedir(), '.dsh', 'im-channel', 'spills');
}
/** Spill an over-long reply to disk; returns the preview text plus its locator. */
function spillIfLong(text) {
    if (text.length <= SPILL_THRESHOLD)
        return { text };
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const locator = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    try {
        mkdirSync(spillsDir(), { recursive: true });
        writeFileSync(join(spillsDir(), `${locator}.txt`), text, 'utf8');
    }
    catch {
        return { text }; // 落盘失败时原样发送，宁长勿丢
    }
    const preview = `${text.slice(0, SPILL_HEAD)}\n\n…〔全文 ${text.length} 字符已保存，发送 /全文 ${locator} 查看〕\n\n${text.slice(text.length - SPILL_TAIL)}`;
    return { text: preview, locator };
}
/** Read back a spilled reply by locator; undefined when missing or invalid. */
function readSpill(locator) {
    if (!/^[a-z0-9]{4,12}$/.test(locator))
        return undefined;
    const file = join(spillsDir(), `${locator}.txt`);
    if (!existsSync(file))
        return undefined;
    try {
        return readFileSync(file, 'utf8');
    }
    catch {
        return undefined;
    }
}
/** 12345 becomes 12.3k for compact token footers. */
function formatTokens(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
/** Chinese command names mapped to their canonical handlers. */
const COMMAND_ALIASES = {
    帮助: 'help',
    状态: 'status',
    新建: 'new',
    clear: 'new',
    项目: 'project',
    模型: 'model',
    模式: 'mode',
    思考: 'think',
    回复: 'reply',
    停止: 'stop',
    cancel: 'stop',
    全文: 'fulltext',
    压缩: 'compact',
};
const COMMAND_LIST = `机器人命令：
/项目 — 选择项目工作区（推荐先选再对话）
/帮助 — 查看这份说明
/状态 — 查看工作区、模型和状态
/新建 或 /clear — 开始新任务
/模型 — 查看 / 切换模型
/思考 — 切换思考级别
/停止 — 停止正在执行的任务
/全文 <编号> — 查看被截断长回复的全文
/压缩 — 压缩会话上下文（仅 Owner）
/回复 — 切换回复详细程度（流式推送过程）
/bind — 绑定当前聊天
/unbind — 解绑当前聊天`;
