import type { Context } from '@deepseek-ai/cordis'
import { isAbsolute, resolve } from 'node:path'
import type { Agent, AgentOptions, AgentRegistry } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { AgentDriver, PromptOptions, SessionOptions } from '../core/router.ts'
import { interruptedNote, modeOf, renderFinal, renderLive, type VerbosityMode } from '../core/render.ts'
import { guestToolDenied, matchesToolPattern } from '../core/guest-permissions.ts'
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
  /** Latest todo/write snapshot (详细 verbosity 进度). */
  todos: Array<{ content: string; status: string }> | undefined
  /** Cumulative input+output tokens of the turn (assistant/message.usage). */
  usageTokens: number
  /** Set when a newer prompt superseded this turn before it settled. */
  interrupted: boolean
  /** Guards resolve/reject against double settlement. */
  ended: boolean
  /** Live progress sink; absent = final-only (tests, future callers). */
  onUpdate?: (view: string) => void
  /** Turn-end metadata (token usage) for reply footers. */
  onMeta?: (meta: { usageTokens: number }) => void
  mode: TurnMode
  /** Last view emitted, to skip no-op re-renders. */
  lastView: string | undefined
}

/** How long a cancelled turn gets to settle before the new prompt forces through. */
const INTERRUPT_SETTLE_TIMEOUT_MS = 8_000

/** Narrow local views of harness services the driver consults dynamically. */
interface GuardCapableTools {
  guard(guard: (execution: Readonly<{ name: string; agent?: { id: string } }>) => string | undefined): unknown
}
interface MaskingLike {
  maskTextSync?: (text: string) => { text: string }
}

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
  /** 访客工具白名单（设置实时读取）；决定 tools.guard 是否放行当前轮的工具调用 */
  private readonly guestTools: () => readonly string[]
  /** 当前轮发起者信息（角色 + userId），按会话记录；工具守卫/审批按此归因 */
  private readonly turnInfos = new Map<string, { actor: 'owner' | 'guest'; userId: string }>()

  private static nextInstanceId = 0
  private readonly instanceId = ++HarnessDriver.nextInstanceId

  constructor(
    private readonly ctx: Context,
    private readonly options: {
      cwd?: string
      agentOptions?: AgentOptions
      mcpRegistry?: WecomMcpRegistry
      guestTools?: () => readonly string[]
      /** 访客工具审批：把决策交给插件层（推卡片给 Owner、等待 IM 回复）。 */
      onOwnerApproval?: (info: { sessionId: string; toolName: string; reason: string | undefined; guestUserId: string | undefined }) => Promise<'allowed-once' | 'rejected'> | undefined
    } = {},
  ) {
    this.agents = ctx.agents
    this.mcpRegistry = options.mcpRegistry
    this.guestTools = options.guestTools ?? ((): readonly string[] => [])
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
    // P0 安全：访客工具守卫注册在【全局层】而非 agent 自有作用域——子代理
    // 绑定的是 standing preset 作用域，继承不到父 agent 层的 guard，注册在
    // 全局层才能覆盖子代理派生的调用。actor 通过 parentSession 链归因到根
    // 会话；非本插件会话（如网页端）无 actor 记录，一律放行。
    if (typeof ctx.inject === 'function') {
      ctx.inject(['tools'], toolsCtx => {
        const svc = (toolsCtx as unknown as { tools?: GuardCapableTools }).tools
        if (svc === undefined || typeof svc.guard !== 'function') return
        svc.guard(execution => {
          const agentId = execution.agent?.id
          if (agentId === undefined || this.actorOfAgent(agentId) !== 'guest') return undefined
          if (matchesToolPattern(execution.name, this.guestTools())) return undefined
          return guestToolDenied(execution.name)
        })
      })
    }
    // P1 审批：访客轮次的非白名单工具升级为 `{kind:'ask'}`，走 harness 的
    // approval/request 瀑布线；由插件层推卡片给 Owner 回复决策。守卫仍作为
    // 无审批服务时的 fail-closed 兜底（ask 无人应答即拒绝）。
    // 事件名走字符串转型：与 assistant/chunk 同理，兼容未声明对应类型
    // 合并的 dsh-tools / dsh-user-approval 版本。
    const serviceEvents = this.ctx as unknown as {
      on: (name: string, handler: (...args: never[]) => Promise<unknown>) => void
    }
    serviceEvents.on('tools/pre-execute', async (exec: Readonly<{ name: string; agent?: { id: string } }>, next: () => Promise<{ kind: 'allow' }>) => {
      const agentId = exec.agent?.id
      if (agentId !== undefined && this.actorOfAgent(agentId) === 'guest' && !matchesToolPattern(exec.name, this.guestTools())) {
        return { kind: 'ask', reason: `访客请求使用工具 ${exec.name}` }
      }
      return await next()
    })
    serviceEvents.on('approval/request', async (req: { agent?: { id: string }; toolName: string; reason?: string }, next: () => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'> => {
      const sessionId = req.agent?.id
      if (sessionId === undefined || !this.owned.has(sessionId)) return await next()
      // 只裁决访客轮次；Owner 轮次的审批交给默认链（通常直接放行）。
      if (this.actorOfAgent(sessionId) !== 'guest') return await next()
      const decide = this.options.onOwnerApproval
      if (decide === undefined) return await next()
      const info = this.turnInfos.get(sessionId)
      try {
        const outcome = await decide({ sessionId, toolName: req.toolName, reason: req.reason, guestUserId: info?.userId })
        return outcome ?? 'rejected'
      } catch {
        return 'rejected'
      }
    })
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
        const usage = (event.data as { usage?: { input?: number; output?: number } }).usage
        if (usage !== undefined) inflight.usageTokens += (usage.input ?? 0) + (usage.output ?? 0)
        if (text.length > 0) {
          inflight.messages.push(text)
          inflight.partial = ''
          this.emitView(inflight)
        }
      } else if ((event.type as string) === 'todo/write') {
        // 任务清单快照：详细模式的进度视图直接消费。
        const todos = (event.data as { todos?: Array<{ content?: string; status?: string }> }).todos
        if (Array.isArray(todos)) {
          inflight.todos = todos
            .filter(t => typeof t?.content === 'string')
            .slice(0, 10)
            .map(t => ({ content: String(t.content), status: String(t.status ?? 'pending') }))
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

  async startSession(options: SessionOptions = {}): Promise<string> {
    const cwd = normalizeCwd(options.cwd ?? this.options.cwd ?? process.cwd())
    const sessionId = SessionId(`session-${crypto.randomUUID()}`)
    await this.createAgent(sessionId, cwd, options.userId, options.isMaster)
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
  async resumeSession(sessionId: string, options: SessionOptions = {}): Promise<string> {
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
        // 注册共享记忆工具
        this.mountSharedMemory(agentCtx, options.userId, options.isMaster)
      },
    })
    this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined })
    // 注入共享记忆摘要到 agent 上下文
    this.injectMemoryContext(handle.agent, options.userId, options.isMaster)
    this.ctx.logger?.info?.(`resumeSession ${sessionId.slice(0, 15)}… owned=${this.owned.size} (driver ${this.instanceId})`)
    return sessionId
  }

  /** Create (or resume) an agent with the gateway-equivalent composition. */
  private async createAgent(
    sessionId: ReturnType<typeof SessionId>,
    cwd: string,
    userId?: string,
    isMaster?: boolean,
  ): Promise<void> {
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
        // 注入共享记忆（如果 dsh-memory 插件已加载）
        this.mountSharedMemory(agentCtx, userId, isMaster)
      },
    })
    this.owned.set(handle.agent.id, { agent: handle.agent, inflight: undefined })
    // 注入共享记忆摘要到 agent 上下文（让 agent 知道有记忆可以读取）
    this.injectMemoryContext(handle.agent, userId, isMaster)
    await this.attachWorkspace(handle.agent.id, cwd)
  }

  /**
   * 归因工具调用的发起角色：沿 parentSession 链回溯到根会话（子代理
   * session.header.parentSession 指向父会话），再查 turnActors。深度上限
   * 防御环；中途 agent 不在注册表时按已知最外层计。
   */
  private actorOfAgent(agentId: string): 'owner' | 'guest' | undefined {
    let id: string = agentId
    for (let depth = 0; depth < 8; depth++) {
      const agent = this.agents.get(id as ReturnType<typeof SessionId>) as { session?: { header: { id: string; parentSession?: string } } } | undefined
      if (agent?.session === undefined) break
      const parent: string | undefined = agent.session.header.parentSession
      if (parent === undefined) {
        id = agent.session.header.id
        break
      }
      id = parent
    }
    return this.turnInfos.get(id)?.actor
  }

  /**
   * P0 安全：外发 IM 前的敏感信息脱敏（masking 服务存在时）。流式视图与
   * 终稿统一走这里；服务不可用时原样返回。
   */
  private maskOutgoing(text: string): string {
    const masking = this.ctx.get('masking') as MaskingLike | undefined
    if (masking?.maskTextSync === undefined || text.length === 0) return text
    try {
      return masking.maskTextSync(text).text
    } catch {
      return text
    }
  }

  /** Token 用量快照（/状态 展示）；token-meter 服务缺席时返回 undefined。 */
  usageOf(sessionId: string): { totalTokens: number } | undefined {
    const record = this.owned.get(sessionId)
    if (record === undefined) return undefined
    const meter = this.ctx.get('tokenMeter') as { measure?: (session: unknown) => { totalTokens: number } } | undefined
    if (meter?.measure === undefined) return undefined
    try {
      return { totalTokens: meter.measure(record.agent.session).totalTokens }
    } catch {
      return undefined
    }
  }

  /** 主动压缩会话（/压缩）；compaction 服务缺席或不适用时返回 false。 */
  async compact(sessionId: string): Promise<boolean> {
    const record = this.owned.get(sessionId)
    if (record === undefined) return false
    const compaction = this.ctx.get('compaction') as { compactNow?: (agent: unknown, signal: AbortSignal) => Promise<unknown> } | undefined
    if (compaction?.compactNow === undefined) return false
    try {
      await compaction.compactNow(record.agent, new AbortController().signal)
      return true
    } catch (error) {
      this.ctx.logger?.warn?.(`compact ${sessionId.slice(0, 8)}… 失败: ${messageOf(error)}`)
      return false
    }
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

  /**
   * 注入共享记忆服务（如果 dsh-memory 插件已加载）。
   * 先即时查询服务；若不可用（插件尚未加载/ACTIVE），用 ctx.inject 延迟注册——
   * dsh-memory 就绪后自动补注册工具，不再静默丢失。
   */
  private mountSharedMemory(agentCtx: unknown, userId?: string, isMaster?: boolean): void {
    const uid = userId ?? 'unknown'
    const master = isMaster ?? false
    const memoryService = this.ctx.get('dsh-memory') as
      | { registerMemoryTools: (ctx: unknown, userId: string, isMaster: boolean) => void }
      | undefined
    if (memoryService !== undefined) {
      memoryService.registerMemoryTools(agentCtx, uid, master)
      return
    }
    // 服务暂不可用：用 inject 等服务就绪后补注册（不再静默跳过）
    this.ctx.logger?.warn?.(`[im-channel] dsh-memory 服务暂不可用，延迟注册记忆工具 (uid=${uid}, master=${master})`)
    const injectCtx = agentCtx as unknown as { inject?: (deps: string[], cb: (ctx: unknown) => void) => void }
    if (typeof injectCtx.inject === 'function') {
      injectCtx.inject(['dsh-memory'], () => {
        const svc = this.ctx.get('dsh-memory') as
          | { registerMemoryTools: (ctx: unknown, userId: string, isMaster: boolean) => void }
          | undefined
        if (svc !== undefined) {
          svc.registerMemoryTools(agentCtx, uid, master)
          this.ctx.logger?.info?.(`[im-channel] dsh-memory 服务就绪，已补注册记忆工具 (uid=${uid}, master=${master})`)
        }
      })
    }
  }

  /**
   * 注入共享记忆摘要到 agent 的上下文，让 agent 知道有记忆可以读取。
   * 使用 system 消息注入，在 agent 首次响应前提供记忆上下文。
   */
  private injectMemoryContext(agent: Agent, userId?: string, isMaster?: boolean): void {
    const memoryService = this.ctx.get('dsh-memory') as
      | { getMemorySummaryForUser: (userId: string, isMaster: boolean) => string }
      | undefined
    if (memoryService === undefined) return

    const uid = userId ?? 'unknown'
    const master = isMaster ?? false
    const summary = memoryService.getMemorySummaryForUser(uid, master)
    if (!summary) return

    try {
      const msg = createUserMessage({
        content: [{ type: 'text', text: summary }],
        source: { kind: 'plugin', plugin: 'dsh-memory' },
      })
      // inject 方法将消息注入到 agent 的上下文中，不唤醒驱动
      agent.inject(msg)
    } catch {
      // 注入失败时静默跳过，不影响正常流程
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
        await this.resumeSession(sessionId, {
          ...(options.userId !== undefined ? { userId: options.userId } : {}),
          ...(options.isMaster !== undefined ? { isMaster: options.isMaster } : {}),
        })
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
        await this.createAgent(SessionId(sessionId), cwd, options.userId, options.isMaster)
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
    // 记录本轮发起者：工具守卫与审批按此归因（含 userId，审批卡片展示用）。
    this.turnInfos.set(sessionId, { actor: options.actor ?? 'owner', userId: options.userId ?? 'unknown' })
    const message = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
    return await new Promise<string>((resolve, reject) => {
      let settleResolve!: () => void
      const settled = new Promise<void>(resolveSettle => { settleResolve = resolveSettle })
      const inflight: InflightTurn = {
        resolve, reject, settleResolve, settled,
        messageId: message.id, turn: undefined,
        messages: [], partial: '', toolLines: [], toolCount: 0,
        todos: undefined, usageTokens: 0,
        interrupted: false, ended: false,
        ...(options.onUpdate !== undefined ? { onUpdate: options.onUpdate } : {}),
        ...(options.onMeta !== undefined ? { onMeta: options.onMeta } : {}),
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
    const view = renderLive(inflight.mode, inflight.messages, inflight.toolLines, inflight.toolCount, inflight.partial, inflight.todos)
    if (view === inflight.lastView) return
    inflight.lastView = view
    sink(this.maskOutgoing(view))
  }

  /** Resolve/reject a turn exactly once and clear its slot. */
  private endTurn(record: { agent: Agent; inflight: InflightTurn | undefined }, inflight: InflightTurn, outcome: { reply?: string; error?: Error }): void {
    if (inflight.ended) return
    inflight.ended = true
    if (record.inflight === inflight) record.inflight = undefined
    // 轮次结束即恢复全量工具能力（下一轮若无 actor 记录则默认放行）。
    this.turnInfos.delete(record.agent.id)
    inflight.settleResolve()
    if (outcome.error !== undefined) {
      inflight.reject(outcome.error)
      return
    }
    if (inflight.onMeta !== undefined && inflight.usageTokens > 0) {
      try { inflight.onMeta({ usageTokens: inflight.usageTokens }) } catch { /* footer is best-effort */ }
    }
    const partial = this.maskOutgoing(outcome.reply ?? '')
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
