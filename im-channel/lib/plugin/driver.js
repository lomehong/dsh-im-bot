import { isAbsolute, resolve } from 'node:path';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { interruptedNote, modeOf, renderFinal, renderLive } from "../core/render.js";
/** How long a cancelled turn gets to settle before the new prompt forces through. */
const INTERRUPT_SETTLE_TIMEOUT_MS = 8_000;
/**
 * AgentDriver over the in-process harness services: one agent per bound IM
 * user, prompt via followup + whenIdle, replies assembled from
 * assistant/message events on the owned session. Modeled on the ACP bridge's
 * inflight-slot pattern (packages/acp/acp/src/index.ts).
 */
export class HarnessDriver {
    ctx;
    options;
    agents;
    /** Agents created by this driver, keyed by session id. */
    owned = new Map();
    static nextInstanceId = 0;
    instanceId = ++HarnessDriver.nextInstanceId;
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.options = options;
        this.agents = ctx.agents;
        // One plugin-lifetime teardown for all owned agents. Registering per
        // session via ctx.effect inside async callbacks attached the disposers to
        // whatever fiber was running the callback (e.g. a router rebuild's
        // fiber), so a router restart silently wiped every bound session.
        ctx.effect(() => {
            const disposers = this.owned;
            return () => {
                for (const [, record] of disposers)
                    void record.agent.ctx.fiber.dispose();
                disposers.clear();
            };
        }, 'im-channel.agents');
        ctx.on('session/event', (session, event) => {
            const record = this.owned.get(session.header.id);
            if (record === undefined || record.agent.session !== session)
                return;
            const inflight = record.inflight;
            if (inflight === undefined)
                return;
            if (event.type === 'assistant/message') {
                const text = event.data.message.content
                    .filter(block => block.type === 'text')
                    .map(block => block.type === 'text' ? block.text : '')
                    .join('');
                if (text.length > 0) {
                    inflight.messages.push(text);
                    inflight.partial = '';
                    this.emitView(inflight);
                }
            }
            else if (event.type === 'assistant/chunk') {
                // Token-level stream of the message being generated: appending the
                // text deltas to the partial makes live views type out in real time.
                // The casts keep this compiling against dsh-session versions whose
                // SessionEventMap predates chunk events.
                const data = event.data;
                const chunk = data.chunk;
                if (chunk?.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text.length > 0
                    && (inflight.turn === undefined || inflight.turn === data.turn)) {
                    inflight.partial += chunk.text;
                    this.emitView(inflight);
                }
            }
            else if (event.type === 'tool/call') {
                inflight.toolCount++;
                inflight.toolLines.push(`🔧 ${event.data.name}`);
                this.emitView(inflight);
            }
            else if (event.type === 'tool/result') {
                const content = event.data.message.content;
                const brief = (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && content[0] !== null && 'text' in content[0]
                    ? String(content[0].text ?? '')
                    : '').split('\n')[0]?.slice(0, 80) ?? '';
                const failed = event.data.error !== undefined;
                inflight.toolLines.push(`   ${failed ? '✗' : '✓'} ${brief}`);
                this.emitView(inflight);
            }
            else if (event.type === 'turn/end' && inflight.turn === event.data.turn) {
                if (event.data.reason.kind === 'error') {
                    this.endTurn(record, inflight, { error: new Error(turnFailureText(event.data.reason)) });
                }
            }
        });
        ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
            const record = this.owned.get(agent.id);
            const inflight = record?.inflight;
            if (inflight !== undefined && inflight.messageId === message.id)
                inflight.turn = turn;
        });
    }
    async startSession(options = {}) {
        const cwd = normalizeCwd(options.cwd ?? this.options.cwd ?? process.cwd());
        const sessionId = SessionId(`session-${crypto.randomUUID()}`);
        await this.createAgent(sessionId, cwd);
        this.ctx.logger?.info?.(`startSession ${sessionId.slice(0, 8)} cwd=${cwd} owned=${this.owned.size} (driver ${this.instanceId})`);
        return sessionId;
    }
    /** Whether this driver currently owns a live agent for the session id. */
    has(sessionId) {
        return this.owned.has(sessionId);
    }
    /**
     * Re-attach to a persisted session after a host restart. Bindings outlive
     * the process; agents.resume loads the stored history (the session's
     * original cwd/meta come from persistence) and re-composes the agent
     * world through the same preset setup as create.
     */
    async resumeSession(sessionId, _options = {}) {
        if (this.owned.has(sessionId))
            return sessionId;
        const presets = this.ctx.get('agentPresets');
        // Same direct-creation caveat as startSession: spell the model route out
        // or persona rendering fails on {{model}}.
        const defaults = this.ctx.get('agentDefaultModel');
        const selection = defaults === undefined ? undefined : defaults.currentSelection();
        const agentOptions = selection !== undefined && selection.provider !== '' && selection.model !== ''
            ? { provider: selection.provider, model: selection.model }
            : undefined;
        const handle = await this.agents.resume({
            resumeSessionId: SessionId(sessionId),
            ...agentOptions === undefined ? {} : { agentOptions },
            setup: async (agentCtx) => {
                if (presets !== undefined)
                    await presets.mount(agentCtx, undefined);
            },
        });
        this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined });
        this.ctx.logger?.info?.(`resumeSession ${sessionId.slice(0, 15)}… owned=${this.owned.size} (driver ${this.instanceId})`);
        return sessionId;
    }
    /** Create (or resume) an agent with the gateway-equivalent composition. */
    async createAgent(sessionId, cwd) {
        const createOptions = {
            sessionId,
            meta: { cwd },
        };
        // The API gateway applies agentDefaultModel for web sessions; agents
        // created directly need the route spelled out or persona rendering fails
        // on {{model}}.
        const defaults = this.ctx.get('agentDefaultModel');
        if (defaults !== undefined) {
            const selection = defaults.currentSelection();
            if (selection.provider !== '' && selection.model !== '') {
                createOptions.agentOptions = { provider: selection.provider, model: selection.model };
            }
        }
        else if (this.options.agentOptions !== undefined) {
            createOptions.agentOptions = this.options.agentOptions;
        }
        // The API gateway composes agents through agentPresets.mount() — that is
        // what attaches tools (bash/fs/editor/…), the full system prompt, and
        // permission policies. Agents created without the setup run bare: the
        // model gets zero tools and a stub persona, and any tool-shaped reply
        // fails. Mirror the gateway composition here.
        const presets = this.ctx.get('agentPresets');
        const resolvedPreset = presets === undefined ? undefined : await presets.resolve(undefined);
        const handle = await this.agents.create({
            sessionId: createOptions.sessionId,
            meta: {
                cwd,
                ...resolvedPreset === undefined ? {} : { agentPreset: resolvedPreset.id },
            },
            ...createOptions.agentOptions === undefined ? {} : { agentOptions: createOptions.agentOptions },
            setup: async (agentCtx) => {
                if (presets !== undefined)
                    await presets.mount(agentCtx, undefined);
            },
        });
        this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined });
        await this.attachWorkspace(handle.agent.id, cwd);
    }
    /** Group the session under the workspace owning its cwd, when registered. */
    async attachWorkspace(sessionId, cwd) {
        // Web-created sessions attach to their workspace explicitly; agents.create
        // does not, so a session here would stay in "ungrouped" even with the
        // right cwd. Attach it to the workspace owning the cwd (if registered).
        const workspaces = this.ctx.get('workspaceRegistry');
        if (workspaces === undefined)
            return;
        try {
            const workspace = await workspaces.resolveByPath(cwd);
            if (workspace !== undefined)
                await workspace.attachSession(sessionId);
        }
        catch {
            // Path not resolvable or registry busy: session stays ungrouped.
        }
    }
    /** Cancel the in-flight turn of a session; false when idle or unknown. */
    cancel(sessionId) {
        const record = this.owned.get(sessionId);
        if (record === undefined || record.inflight === undefined)
            return false;
        record.agent.cancel({ kind: 'user' });
        return true;
    }
    async prompt(sessionId, text, options = {}) {
        const record = this.owned.get(sessionId);
        this.ctx.logger?.debug?.(`prompt ${sessionId.slice(0, 8)} owned=${this.owned.size} found=${record !== undefined} (driver ${this.instanceId})`);
        if (record === undefined) {
            // A binding persisted across a harness restart points at a session this
            // driver never created — tell the router instead of crashing the host.
            throw new Error(`会话 ${sessionId.slice(0, 8)} 已失效（服务重启过）。请发送 /bind 重新绑定。`);
        }
        // Mobile chat UX: new input interrupts the running turn instead of
        // erroring. Cancel it, let the old promise settle with its partial
        // output, then submit the new message.
        const prior = record.inflight;
        if (prior !== undefined) {
            prior.interrupted = true;
            try {
                record.agent.cancel({ kind: 'user' });
            }
            catch {
                // Already-idle or disposed: the settle race below still works.
            }
            await Promise.race([prior.settled, sleep(INTERRUPT_SETTLE_TIMEOUT_MS)]);
            if (record.inflight === prior) {
                // The cancel did not idle the agent in time (stuck tool). Force the
                // old turn closed so its caller is not left hanging; the new
                // followup queues in the inbox until the agent frees up.
                this.endTurn(record, prior, { reply: renderFinal(prior.mode, prior.messages, prior.toolLines) });
            }
        }
        const mode = modeOf(options.verbosity);
        const message = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } });
        return await new Promise((resolve, reject) => {
            let settleResolve;
            const settled = new Promise(resolveSettle => { settleResolve = resolveSettle; });
            const inflight = {
                resolve, reject, settleResolve, settled,
                messageId: message.id, turn: undefined,
                messages: [], partial: '', toolLines: [], toolCount: 0,
                interrupted: false, ended: false,
                ...(options.onUpdate !== undefined ? { onUpdate: options.onUpdate } : {}),
                mode, lastView: undefined,
            };
            record.inflight = inflight;
            try {
                record.agent.followup(message);
            }
            catch (error) {
                this.endTurn(record, inflight, { error: error instanceof Error ? error : new Error(String(error)) });
                return;
            }
            this.emitView(inflight);
            void record.agent.whenIdle().then(() => {
                this.endTurn(record, inflight, { reply: renderFinal(inflight.mode, inflight.messages, inflight.toolLines) });
            });
        });
    }
    /** Push the current turn view to the live sink, skipping no-op renders. */
    emitView(inflight) {
        const sink = inflight.onUpdate;
        if (sink === undefined || inflight.ended)
            return;
        const view = renderLive(inflight.mode, inflight.messages, inflight.toolLines, inflight.toolCount, inflight.partial);
        if (view === inflight.lastView)
            return;
        inflight.lastView = view;
        sink(view);
    }
    /** Resolve/reject a turn exactly once and clear its slot. */
    endTurn(record, inflight, outcome) {
        if (inflight.ended)
            return;
        inflight.ended = true;
        if (record.inflight === inflight)
            record.inflight = undefined;
        inflight.settleResolve();
        if (outcome.error !== undefined) {
            inflight.reject(outcome.error);
            return;
        }
        const partial = outcome.reply ?? '';
        inflight.resolve(inflight.interrupted ? interruptedNote(partial) : partial);
    }
}
function normalizeCwd(rawCwd) {
    // Normalize separators/case (e.g. 'D:/x' vs 'D:\x') so the workspace
    // registry's canonical-cwd index groups the session under its project
    // instead of "ungrouped".
    return isAbsolute(rawCwd) ? resolve(rawCwd) : rawCwd;
}
function turnFailureText(reason) {
    const text = JSON.stringify(reason);
    return `turn failed: ${text === undefined ? String(reason) : text.slice(0, 300)}`;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
