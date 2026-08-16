/**
 * HarnessDriver tests: drives the agent lifecycle through a fake AgentRegistry
 * + a controllable session/event bus, covering normal prompt, in-flight
 * interrupt, session resume, and the turn-end error path.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Agent, AgentHandle, AgentOptions, AgentRegistry } from '@deepseek-ai/dsh-agent'
import { randomUUID } from 'node:crypto'

// @deepseek-ai/dsh-llm has transitive peer deps that are not installed in
// this profile; provide a minimal createUserMessage stub so driver.ts loads.
vi.mock('@deepseek-ai/dsh-llm', () => ({
  createUserMessage: (input: { content: unknown[]; source: { kind: string } }) => ({
    id: `user-${randomUUID()}`,
    role: 'user',
    ...input,
  }),
}))

const { HarnessDriver } = await import('../src/plugin/driver.ts')

interface FakeSession {
  header: { id: string; version: number; createdAt: number }
}

interface FakeAgent {
  id: string
  session: FakeSession
  ctx: { fiber: { dispose: () => Promise<void> } }
  cancelCalls: Array<{ kind: string }>
  followupCalls: Array<{ id: string }>
  /** Each whenIdle() call arms one deferred; the test resolves it to settle that turn. */
  idleResolvers: Array<() => void>
  /** Each call pushes a fresh resolver onto idleResolvers; settleAgent() pops one. */
  whenIdle: () => Promise<void>
  /** Driver-invoked methods: just record the call. */
  cancel: (cause: { kind: string }) => void
  followup: (msg: { id: string }) => void
}

interface FakeContext {
  agents: AgentRegistry
  /** Lookup created/resumed agents by id; the harness inspects them via ctx.agents. */
  agentById: Map<string, FakeAgent>
  effect: ReturnType<typeof vi.fn>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  eventHandlers: Map<string, Array<(...args: unknown[]) => void>>
  get: ReturnType<typeof vi.fn>
  logger: { info?: ReturnType<typeof vi.fn>; debug?: ReturnType<typeof vi.fn> }
}

function makeAgent(id: string): FakeAgent {
  const idleResolvers: Array<() => void> = []
  const followupCalls: Array<{ id: string }> = []
  const cancelCalls: Array<{ kind: string }> = []
  return {
    id,
    session: { header: { id, version: 0, createdAt: Date.now() } },
    ctx: { fiber: { dispose: () => Promise.resolve() } },
    cancelCalls,
    followupCalls,
    idleResolvers,
    whenIdle: () => new Promise<void>(resolve => idleResolvers.push(resolve)),
    cancel(cause) { cancelCalls.push(cause) },
    followup(msg) { followupCalls.push(msg) },
  }
}

function makeContext(): FakeContext {
  const eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>()
  const agentById = new Map<string, FakeAgent>()
  const wrap = (id: string): AgentHandle => {
    const agent = makeAgent(id)
    agentById.set(id, agent)
    return { agent: agent as unknown as Agent, dispose: () => Promise.resolve() }
  }
  const registry: Partial<AgentRegistry> = {
    create: vi.fn(async (options: { sessionId: { toString(): string } }) => wrap(options.sessionId.toString())),
    resume: vi.fn(async (options: { resumeSessionId: { toString(): string } }) => wrap(options.resumeSessionId.toString())),
  }
  return {
    agents: registry as AgentRegistry,
    agentById,
    effect: vi.fn(),
    on: (event, handler) => {
      const list = eventHandlers.get(event) ?? []
      list.push(handler)
      eventHandlers.set(event, list)
    },
    eventHandlers,
    get: vi.fn(() => undefined),
    logger: { info: vi.fn(), debug: vi.fn() },
  }
}

/** Emit a session event into the driver: same shape the harness fires. */
function emit(ctx: FakeContext, agent: FakeAgent, event: Record<string, unknown>): void {
  const handlers = ctx.eventHandlers.get('session/event') ?? []
  for (const handler of handlers) handler(agent.session, event)
}

/** Settle the agent's most-recently-armed whenIdle() promise. */
function settleAgent(agent: FakeAgent): void {
  const pending = agent.idleResolvers.shift()
  if (pending !== undefined) pending()
}

function drain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('HarnessDriver.startSession', () => {
  it('creates an agent, forwards session events into the live view, and answers a prompt', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const sessionId = await driver.startSession({ cwd: '/tmp/proj' })
    expect(ctx.agents.create).toHaveBeenCalledTimes(1)
    expect(driver.has(sessionId)).toBe(true)
    const agent = ctx.agentById.get(sessionId)!

    const views: string[] = []
    const reply = driver.prompt(sessionId, 'hello', { verbosity: '标准', onUpdate: v => views.push(v) })
    await drain()
    // emit the assistant text after followup; the driver appends it as a finalized message
    emit(ctx, agent, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'reply chunk' }] } },
    })
    settleAgent(agent)
    await expect(reply).resolves.toBe('reply chunk')
    expect(views.some(v => v.includes('reply chunk'))).toBe(true)
  })

  it('returns false from cancel when no turn is in flight', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const sessionId = await driver.startSession({ cwd: '/tmp/proj' })
    expect(driver.cancel(sessionId)).toBe(false)
  })
})

describe('HarnessDriver.resumeSession', () => {
  it('is a no-op when the driver already owns the session', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const sessionId = await driver.startSession({ cwd: '/tmp/proj' })
    await driver.resumeSession(sessionId)
    expect(ctx.agents.create).toHaveBeenCalledTimes(1)
    expect(ctx.agents.resume).not.toHaveBeenCalled()
  })

  it('re-attaches a session id this driver never created', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const id = 'session-resumed'
    const result = await driver.resumeSession(id)
    expect(result).toBe(id)
    expect(driver.has(id)).toBe(true)
    expect(ctx.agents.resume).toHaveBeenCalledTimes(1)
  })

  it('passes agent options when a default model is registered', async () => {
    const ctx = makeContext()
    ;(ctx.get as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
      return undefined
    })
    const driver = new HarnessDriver(ctx as unknown as never)
    await driver.resumeSession('session-r2')
    const call = (ctx.agents.resume as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { agentOptions?: AgentOptions }
    expect(call.agentOptions).toEqual({ provider: 'p', model: 'm' })
  })
})

describe('HarnessDriver.prompt', () => {
  it('rejects with a binding-expired message when the session is unknown', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    await expect(driver.prompt('session-gone', 'hi')).rejects.toThrow(/重新绑定/)
  })

  it('interrupts the prior turn, prefixes the reply with the interrupted note, and runs the new prompt', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const sessionId = await driver.startSession({ cwd: '/tmp/proj' })
    const agent = ctx.agentById.get(sessionId)!

    const first = driver.prompt(sessionId, 'first')
    await drain()
    emit(ctx, agent, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'first partial' }] } },
    })
    // Issue the interrupting prompt: prior must be cancelled, second whenIdle armed.
    const second = driver.prompt(sessionId, 'second')
    expect(agent.cancelCalls.length).toBeGreaterThan(0)
    // Settle the first turn (its whenIdle was armed on first.prompt).
    settleAgent(agent)
    const firstReply = await first
    expect(firstReply.startsWith('⏹')).toBe(true)
    expect(firstReply).toContain('first partial')

    // Second prompt resolves normally via the agent's default whenIdle.
    emit(ctx, agent, {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'second reply' }] } },
    })
    settleAgent(agent)
    await expect(second).resolves.toBe('second reply')
  })

  it('rejects the turn when turn/end carries an error reason', async () => {
    const ctx = makeContext()
    const driver = new HarnessDriver(ctx as unknown as never)
    const sessionId = await driver.startSession({ cwd: '/tmp/proj' })
    const agent = ctx.agentById.get(sessionId)!

    // Force the in-flight turn number so the driver treats the error event
    // as belonging to this turn (without a real claim event we have to fake it).
    const promise = driver.prompt(sessionId, 'go')
    await drain()
    // Pull the in-flight turn from the driver's record via a direct helper
    // by emitting a fake inbox/claimed, then a turn/end for turn 1.
    const claimedHandlers = ctx.eventHandlers.get('agent/inbox/claimed') ?? []
    const followupMessage = agent.followupCalls.at(-1)!
    for (const handler of claimedHandlers) handler({ agent: agent as unknown as Agent, message: followupMessage, turn: 1 })
    emit(ctx, agent, {
      type: 'turn/end',
      data: { turn: 1, reason: { kind: 'error', message: 'broke' } },
    })
    await expect(promise).rejects.toThrow(/turn failed/)
  })
})