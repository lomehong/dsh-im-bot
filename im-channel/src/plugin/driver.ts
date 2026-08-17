import type { Context } from '@deepseek-ai/cordis'
import { isAbsolute, resolve } from 'node:path'
import type { Agent, AgentOptions, AgentRegistry } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { AgentDriver, PromptOptions } from '../core/router.ts'
import { interruptedNote, modeOf, renderFinal, renderLive, type VerbosityMode } from '../core/render.ts'
import type { WecomMcpRegistry } from '../channels/wecom/wecom-mcp-registry.ts'

/** Live-update cadence derived from the /回复 verbosity. */
type TurnMode = VerbosityMode

interface InflightTurn {
  resolve: (reply: string) => void
  reject: (error: Error) => void
  /** Resolves once the turn has been resolved/rejected (interrupt barrier). */
  settleResolve: () => void
  settled: Promise<void>
  messageId: string
  turn: number | undefined
  /** Each assistant/message's text, one entry per message (verbosity 裁剪用). */
  messages: string[]
  /** Unfinalized tail assembled from assistant/chunk text-delta events. */
  partial: string
  /** Tool-call summaries in order (详细 verbosity). */
  toolLines: string[]
  /** Count of tool/call events (简洁 status line). */
  toolCount: number
  /** Set when a newer prompt superseded this turn before it settled. */
  interrupted: boolean
  /** Guards resolve/reject against double settlement. */
  ended: boolean
  /** Live progress sink; absent = final-only (tests, future callers). */
  onUpdate?: (view: string) => void
  mode: TurnMode
  /** Last view emitted, to skip no-op re-renders. */
  lastView: string | undefined
}

/** How long a cancelled turn gets to settle before the new prompt forces through. */
const INTERRUPT_SETTLE_TIMEOUT_MS = 8_000

/**
 * AgentDriver over the in-process harness services: one agent per bound IM
 * user, prompt via followup + whenIdle, replies assembled from
 * assistant/message events on the owned session. Modeled on the ACP bridge's
 * inflight-slot pattern (packages/acp/acp/src/index.ts).
 */
export class HarnessDriver implements AgentDriver {
  private readonly agents: AgentRegistry
  /** Agents created by this driver, keyed by session id. */
  private readonly owned = new Map<string, { agent: Agent; inflight: InflightTurn | undefined }>()
  /** MCP 工具注册表（企业微信） */
  private readonly mcpRegistry: WecomMcpRegistry | undefined

  private static nextInstanceId = 0
  private readonly instanceId = ++HarnessDriver.nextInstanceId

  constructor(
    private readonly ctx: Context,
    private readonly options: { cwd?: string; agentOptions?: AgentOptions; mcpRegistry?: WecomMcpRegistry } = {},
  ) {
    this.agents = ctx.agents
    this.mcpRegistry = options.mcpRegistry
    // One plugin-lifetime teardown for all owned agents. Registering per
    // session via ctx.effect inside async callbacks attached the disposers to
    // whatever fiber was running the callback (e.g. a router rebuild's
    // fiber), so a router restart silently wiped every bound session.
    ctx.effect(() => {
      const disposers = this.owned
      return () => {
        for (const [, record] of disposers) void record.agent.ctx.fiber.dispose()
        disposers.clear()
      }
    }, 'im-channel.agents')
    ctx.on('session/event', (session, event: SessionEvent) => {
      const record = this.owned.get(session.header.id)
      if (record === undefined || record.agent.session !== session) return
      const inflight = record.inflight
      if (inflight === undefined) return
      if (event.type === 'assistant/message') {
        const text = event.data.message.content
          .filter(block => block.type === 'text')
          .map(block => block.type === 'text' ? block.text : '')
          .join('')
        if (text.length > 0) {
          inflight.messages.push(text)
          inflight.partial = ''
          this.emitView(inflight)
        }
      } else if ((event.type as string) === 'assistant/chunk') {
        // Token-level stream of the message being generated: appending the
        // text deltas to the partial makes live views type out in real time.
        // The casts keep this compiling against dsh-session versions whose
        // SessionEventMap predates chunk events.
        const data = event.data as { turn?: number; chunk?: { type?: string; text?: string } }
        const chunk = data.chunk
        if (chunk?.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text.length > 0
          && (inflight.turn === undefined || inflight.turn === data.turn)) {
          inflight.partial += chunk.text
          this.emitView(inflight)
        }
      } else if (event.type === 'tool/call') {
        inflight.toolCount++
        inflight.toolLines.push(`🔧 ${event.data.name}`)
        this.emitView(inflight)
      } else if (event.type === 'tool/result') {
        const content = event.data.message.content
        const brief = (Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && content[0] !== null && 'text' in content[0]
          ? String((content[0] as { text?: string }).text ?? '')
          : '').split('\n')[0]?.slice(0, 80) ?? ''
        const failed = event.data.error !== undefined
        inflight.toolLines.push(`   ${failed ? '✗' : '✓'} ${brief}`)
        this.emitView(inflight)
      } else if (event.type === 'turn/end' && inflight.turn === event.data.turn) {
        if (event.data.reason.kind === 'error') {
          this.endTurn(record, inflight, { error: new Error(turnFailureText(event.data.reason)) })
        }
      }
    })
    ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
      const record = this.owned.get(agent.id)
      const inflight = record?.inflight
      if (inflight !== undefined && inflight.messageId === message.id) inflight.turn = turn
    })
  }

  async startSession(options: { cwd?: string } = {}): Promise<string> {
    const cwd = normalizeCwd(options.cwd ?? this.options.cwd ?? process.cwd())
    const sessionId = SessionId(`session-${crypto.randomUUID()}`)
    await this.createAgent(sessionId, cwd)
    this.ctx.logger?.info?.(`startSession ${sessionId.slice(0, 8)} cwd=${cwd} owned=${this.owned.size} (driver ${this.instanceId})`)
    return sessionId
  }

  /** Whether this driver currently owns a live agent for the session id. */
  has(sessionId: string): boolean {
    return this.owned.has(sessionId)
  }

  /**
   * Re-attach to a persisted session after a host restart. Bindings outlive
   * the process; agents.resume loads the stored history (the session's
   * original cwd/meta come from persistence) and re-composes the agent
   * world through the same preset setup as create.
   */
  async resumeSession(sessionId: string, _options: { cwd?: string } = {}): Promise<string> {
    if (this.owned.has(sessionId)) return sessionId
    const presets = this.ctx.get('agentPresets')
    // Same direct-creation caveat as startSession: spell the model route out
    // or persona rendering fails on {{model}}.
    const defaults = this.ctx.get('agentDefaultModel')
    const selection = defaults === undefined ? undefined : defaults.currentSelection() as { provider: string; model: string }
    const agentOptions = selection !== undefined && selection.provider !== '' && selection.model !== ''
      ? { provider: selection.provider, model: selection.model } satisfies AgentOptions
      : undefined
    const handle = await this.agents.resume({
      resumeSessionId: SessionId(sessionId),
      ...agentOptions === undefined ? {} : { agentOptions },
      setup: async agentCtx => {
        if (presets !== undefined) await presets.mount(agentCtx, undefined)
        // 注册 MCP 工具
        if (this.mcpRegistry !== undefined) {
          await this.mcpRegistry.registerToAgent(agentCtx)
        }
      },
    })
    this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined })
    this.ctx.logger?.info?.(`resumeSession ${sessionId.slice(0, 15)}… owned=${this.owned.size} (driver ${this.instanceId})`)
    return sessionId
  }

  /** Create (or resume) an agent with the gateway-equivalent composition. */
  private async createAgent(sessionId: ReturnType<typeof SessionId>, cwd: string): Promise<void> {
    const createOptions: { sessionId: ReturnType<typeof SessionId>; meta: { cwd: string }; agentOptions?: AgentOptions } = {
      sessionId,
      meta: { cwd },
    }
    // The API gateway applies agentDefaultModel for web sessions; agents
    // created directly need the route spelled out or persona rendering fails
    // on {{model}}.
    const defaults = this.ctx.get('agentDefaultModel')
    if (defaults !== undefined) {
      const selection = defaults.currentSelection() as { provider: string; model: string; reasoningEffort?: string }
      if (selection.provider !== '' && selection.model !== '') {
        createOptions.agentOptions = { provider: selection.provider, model: selection.model }
      }
    } else if (this.options.agentOptions !== undefined) {
      createOptions.agentOptions = this.options.agentOptions
    }
    // The API gateway composes agents through agentPresets.mount() — that is
    // what attaches tools (bash/fs/editor/…), the full system prompt, and
    // permission policies. Agents created without the setup run bare: the
    // model gets zero tools and a stub persona, and any tool-shaped reply
    // fails. Mirror the gateway composition here.
    const presets = this.ctx.get('agentPresets')
    const resolvedPreset = presets === undefined ? undefined : await presets.resolve(undefined)
    const handle = await this.agents.create({
      sessionId: createOptions.sessionId,
      meta: {
        cwd,
        ...resolvedPreset === undefined ? {} : { agentPreset: resolvedPreset.id },
      },
      ...createOptions.agentOptions === undefined ? {} : { agentOptions: createOptions.agentOptions },
      setup: async agentCtx => {
        if (presets !== undefined) await presets.mount(agentCtx, undefined)
        // 注册 MCP 工具
        if (this.mcpRegistry !== undefined) {
          await this.mcpRegistry.registerToAgent(agentCtx)
        }
      },
    })
    this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined })
    await this.attachWorkspace(handle.agent.id, cwd)
  }

  /** Group the session under the workspace owning its cwd, when registered. */
  private async attachWorkspace(sessionId: string, cwd: string): Promise<void> {
    // Web-created sessions attach to their workspace explicitly; agents.create
    // does not, so a session here would stay in "ungrouped" even with the
    // right cwd. Attach it to the workspace owning the cwd (if registered).
    const workspaces = this.ctx.get('workspaceRegistry') as
      | { resolveByPath(path: string): Promise<{ attachSession(sessionId: string): Promise<void> } | undefined> }
      | undefined
    if (workspaces === undefined) return
    try {
      const workspace = await workspaces.resolveByPath(cwd)
      if (workspace !== undefined) await workspace.attachSession(sessionId)
    } catch {
      // Path not resolvable or registry busy: session stays ungrouped.
    }
  }

  /** Cancel the in-flight turn of a session; false when idle or unknown. */
  cancel(sessionId: string): boolean {
    const record = this.owned.get(sessionId)
    if (record === undefined || record.inflight === undefined) return false
    record.agent.cancel({ kind: 'user' })
    return true
  }

  async prompt(sessionId: string, text: string, options: PromptOptions = {}): Promise<string> {
    let record = this.owned.get(sessionId)
    // 如果 session 不在内存中（例如服务重启后第一次对话），尝试恢复
    if (record === undefined) {
      this.ctx.logger?.info?.(`prompt ${sessionId.slice(0, 8)} 不在内存中，尝试恢复会话 (driver ${this.instanceId})`)
      try {
        await this.resumeSession(sessionId)
        record = this.owned.get(sessionId)
      } catch (resumeError) {
        this.ctx.logger?.warn?.(`prompt ${sessionId.slice(0, 8)} 恢复失败，将创建新会话: ${messageOf(resumeError)} (driver ${this.instanceId})`)
      }
    }
    // 如果恢复失败，创建一个新会话（保持相同的 sessionId，不丢失绑定）
    if (record === undefined) {
      this.ctx.logger?.info?.(`prompt ${sessionId.slice(0, 8)} 创建新会话 (driver ${this.instanceId})`)
      try {
        const cwd = normalizeCwd(this.options.cwd ?? process.cwd())
        await this.createAgent(SessionId(sessionId), cwd)
        record = this.owned.get(sessionId)!
      } catch (createError) {
        this.ctx.logger?.error?.(`prompt ${sessionId.slice(0, 8)} 创建新会话也失败: ${messageOf(createError)} (driver ${this.instanceId})`)
        throw new Error(`会话创建失败，请发送 /bind 重新绑定。`)
      }
    }
    // 此时 record 必定存在（恢复了、创建了新会话、或抛出了错误）
    // 断言非空，后面的代码不需要再检查 undefined
    const prior = record!.inflight
    if (prior !== undefined) {
      prior.interrupted = true
      try {
        record!.agent.cancel({ kind: 'user' })
      } catch {
        // Already-idle or disposed: the settle race below still works.
      }
      await Promise.race([prior.settled, sleep(INTERRUPT_SETTLE_TIMEOUT_MS)])
      if (record!.inflight === prior) {
        // The cancel did not idle the agent in time (stuck tool). Force the
        // old turn closed so its caller is not left hanging; the new
        // followup queues in the inbox until the agent frees up.
        this.endTurn(record!, prior, { reply: renderFinal(prior.mode, prior.messages, prior.toolLines) })
      }
    }
    const mode = modeOf(options.verbosity)
    const message = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
    return await new Promise<string>((resolve, reject) => {
      let settleResolve!: () => void
      const settled = new Promise<void>(resolveSettle => { settleResolve = resolveSettle })
      const inflight: InflightTurn = {
        resolve, reject, settleResolve, settled,
        messageId: message.id, turn: undefined,
        messages: [], partial: '', toolLines: [], toolCount: 0,
        interrupted: false, ended: false,
        ...(options.onUpdate !== undefined ? { onUpdate: options.onUpdate } : {}),
        mode, lastView: undefined,
      }
      record!.inflight = inflight
      try {
        record!.agent.followup(message)
      } catch (error: unknown) {
        this.endTurn(record!, inflight, { error: error instanceof Error ? error : new Error(String(error)) })
        return
      }
      this.emitView(inflight)
      void record!.agent.whenIdle().then(() => {
        this.endTurn(record!, inflight, { reply: renderFinal(inflight.mode, inflight.messages, inflight.toolLines) })
      })
    })
  }

  /** Push the current turn view to the live sink, skipping no-op renders. */
  private emitView(inflight: InflightTurn): void {
    const sink = inflight.onUpdate
    if (sink === undefined || inflight.ended) return
    const view = renderLive(inflight.mode, inflight.messages, inflight.toolLines, inflight.toolCount, inflight.partial)
    if (view === inflight.lastView) return
    inflight.lastView = view
    sink(view)
  }

  /** Resolve/reject a turn exactly once and clear its slot. */
  private endTurn(record: { agent: Agent; inflight: InflightTurn | undefined }, inflight: InflightTurn, outcome: { reply?: string; error?: Error }): void {
    if (inflight.ended) return
    inflight.ended = true
    if (record.inflight === inflight) record.inflight = undefined
    inflight.settleResolve()
    if (outcome.error !== undefined) {
      inflight.reject(outcome.error)
      return
    }
    const partial = outcome.reply ?? ''
    inflight.resolve(inflight.interrupted ? interruptedNote(partial) : partial)
  }
}

function normalizeCwd(rawCwd: string): string {
  // Normalize separators/case (e.g. 'D:/x' vs 'D:\x') so the workspace
  // registry's canonical-cwd index groups the session under its project
  // instead of "ungrouped".
  return isAbsolute(rawCwd) ? resolve(rawCwd) : rawCwd
}

function turnFailureText(reason: unknown): string {
  const text = JSON.stringify(reason)
  return `turn failed: ${text === undefined ? String(reason) : text.slice(0, 300)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
