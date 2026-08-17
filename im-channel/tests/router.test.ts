import { describe, expect, it, vi } from 'vitest'
import { Router, type AgentDriver, type PromptOptions, type SessionOptions } from '../src/core/router.ts'
import type { ImChannel, ImUserId, InboundMessage, OutboundMessage, ReplyTarget, TurnMode, TurnSink } from '../src/core/channel.ts'

/** Settling buffer for fire-and-forget routeMessage promises. */
async function settle(ms = 20): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

class FakeSink implements TurnSink {
  views: string[] = []
  finished: { text: string; markdown?: boolean } | undefined
  failed: string | undefined
  update(view: string): void { this.views.push(view) }
  async finish(final: { text: string; markdown?: boolean }): Promise<void> { this.finished = final }
  async fail(message: string): Promise<void> { this.failed = message }
}

class FakeChannel implements ImChannel {
  readonly kind = 'feishu' as const
  readonly label = '飞书'
  configured = true
  connected = false
  connectFails = false
  sendFails = false
  sent: OutboundMessage[] = []
  openModes: TurnMode[] = []
  sinks: FakeSink[] = []
  deadReported: string[] = []
  private handler: ((message: InboundMessage) => void) | undefined

  isConfigured(): boolean { return this.configured }
  async connect(): Promise<void> {
    if (this.connectFails) throw new Error('connect boom')
    this.connected = true
  }
  onMessage(handler: (message: InboundMessage) => void): void { this.handler = handler }
  async send(_target: ReplyTarget, message: OutboundMessage): Promise<void> {
    if (this.sendFails) throw new Error('send boom')
    this.sent.push(message)
  }
  async openTurn(_target: ReplyTarget, options: { mode: TurnMode }): Promise<TurnSink> {
    this.openModes.push(options.mode)
    const sink = new FakeSink()
    this.sinks.push(sink)
    return sink
  }
  onDead(handler: (reason: string) => void): void {
    this.deadReported.push('wired')
    void handler('token stale')
  }
  async stop(): Promise<void> {}
  /** Test helper: feed one inbound message into the router. */
  receive(text: string, userId = 'ou_user1'): void {
    this.handler?.({ from: { kind: this.kind, userId: userId as ImUserId }, text, messageId: `m-${Math.random()}` })
  }
}

class FakeDriver implements AgentDriver {
  started: SessionOptions[] = []
  resumed: Array<{ sessionId: string; options: SessionOptions | undefined }> = []
  ownedIds = new Set<string>()
  resumeFails = false
  promptCalls: Array<{ sessionId: string; text: string; options: PromptOptions | undefined }> = []
  nextReply = 'final reply'
  updates: string[] = ['⏳ 正在思考…', '中间一段']

  async startSession(options?: SessionOptions): Promise<string> {
    this.started.push(options ?? {})
    const id = `session-${this.started.length}`
    this.ownedIds.add(id)
    return id
  }
  has(sessionId: string): boolean { return this.ownedIds.has(sessionId) }
  async resumeSession(sessionId: string, options?: SessionOptions): Promise<string> {
    this.resumed.push({ sessionId, options })
    if (this.resumeFails) throw new Error('session gone')
    this.ownedIds.add(sessionId)
    return sessionId
  }
  async prompt(sessionId: string, text: string, options?: PromptOptions): Promise<string> {
    this.promptCalls.push({ sessionId, text, options })
    for (const view of this.updates) options?.onUpdate?.(view)
    return this.nextReply
  }
}

class FakeStore {
  rows = new Map<string, { sessionId: string; isMaster?: boolean; boundAt?: string; verbosity?: string; workspace?: string; targetId?: string }>()
  private key(ref: { kind: string; userId: string }): string { return `${ref.kind}:${ref.userId}` }
  bind(ref: { kind: string; userId: string }, sessionId: string, isMaster?: boolean): void {
    const existing = this.rows.get(this.key(ref))
    if (existing !== undefined) {
      existing.sessionId = sessionId
      existing.boundAt = new Date().toISOString()
      if (isMaster !== undefined) existing.isMaster = isMaster
    } else {
      this.rows.set(this.key(ref), { sessionId, boundAt: new Date().toISOString(), ...(isMaster ? { isMaster: true } : {}) })
    }
  }
  sessionIdFor(ref: { kind: string; userId: string }): string | undefined { return this.rows.get(this.key(ref))?.sessionId }
  isMasterFor(ref: { kind: string; userId: string }): boolean { return this.rows.get(this.key(ref))?.isMaster === true }
  ownerFor(kind: string): { userId: string; sessionId: string } | undefined {
    const rows = [...this.rows.entries()]
      .filter(([key, row]) => key.startsWith(`${kind}:`) && row.isMaster === true)
      .sort(([, a], [, b]) => (a.boundAt ?? '').localeCompare(b.boundAt ?? ''))
    const [key, row] = rows[0] ?? []
    return key === undefined || row === undefined ? undefined : { userId: key.split(':')[1]!, sessionId: row.sessionId }
  }
  unbind(ref: { kind: string; userId: string }): boolean { return this.rows.delete(this.key(ref)) }
  verbosityFor(ref: { kind: string; userId: string }): string | undefined { return this.rows.get(this.key(ref))?.verbosity }
  setVerbosity(ref: { kind: string; userId: string }, level: '简洁' | '标准' | '详细'): void {
    const row = this.rows.get(this.key(ref))
    if (row !== undefined) row.verbosity = level
  }
  selectWorkspace(ref: { kind: string; userId: string }, path: string): void {
    const row = this.rows.get(this.key(ref))
    if (row !== undefined) row.workspace = path
  }
  workspaceFor(ref: { kind: string; userId: string }): string | undefined { return this.rows.get(this.key(ref))?.workspace }
  rememberTarget(ref: { kind: string; userId: string }, targetId: string): void {
    const row = this.rows.get(this.key(ref))
    if (row !== undefined) row.targetId = targetId
  }
}

interface Harness {
  channel: FakeChannel
  driver: FakeDriver
  store: FakeStore
  router: Router
  logs: string[]
}

async function makeRouter(options: { allow?: (from: { kind: string; userId: string }) => boolean } = {}): Promise<Harness> {
  const channel = new FakeChannel()
  const driver = new FakeDriver()
  const store = new FakeStore()
  const logs: string[] = []
  const router = new Router({
    channels: [channel],
    driver,
    store,
    log: line => logs.push(line),
    ...(options.allow !== undefined ? { allowed: options.allow } : {}),
  })
  await router.start()
  return { channel, driver, store, router, logs }
}

/** Channel owner with a workspace picked — the digital-avatar steady state. */
function bindReady(h: Harness, userId = 'ou_user1'): void {
  h.store.bind({ kind: 'feishu', userId }, 'session-1', true)
  h.driver.ownedIds.add('session-1')
  h.store.selectWorkspace({ kind: 'feishu', userId }, 'E:\\proj')
}

describe('router.start', () => {
  it('keeps other channels alive when one connect fails', async () => {
    const bad = new FakeChannel()
    bad.connectFails = true
    const good = new FakeChannel()
    const logs: string[] = []
    const router = new Router({ channels: [bad, good], driver: new FakeDriver(), store: new FakeStore(), log: line => logs.push(line) })
    await router.start()
    expect(good.connected).toBe(true)
    expect(bad.connected).toBe(false)
    expect(logs.some(line => line.includes('渠道连接失败'))).toBe(true)
  })

  it('wires channel death reports to the log', async () => {
    const h = await makeRouter()
    expect(h.channel.deadReported).toContain('wired')
    expect(h.logs.some(line => line.includes('已掉线') && line.includes('token stale'))).toBe(true)
  })
})

describe('router chat path', () => {
  it('asks for setup when the channel has no owner yet', async () => {
    const h = await makeRouter()
    h.channel.receive('你好')
    await settle()
    expect(h.channel.sent.length).toBe(1)
    expect(h.channel.sent[0]?.text).toContain('/bind')
    expect(h.channel.sent[0]?.text).toContain('尚未初始化')
    expect(h.driver.promptCalls.length).toBe(0)
  })

  it('guests ride the owner avatar session with a guest actor tag', async () => {
    const h = await makeRouter()
    bindReady(h, 'ou_owner')
    h.channel.receive('你好', 'ou_guest')
    await settle()
    // No guest session is created: the prompt lands on the owner's session
    // with the visitor identity prefix and actor=guest for tool gating.
    expect(h.driver.started.length).toBe(0)
    expect(h.driver.promptCalls.length).toBe(1)
    expect(h.driver.promptCalls[0]?.sessionId).toBe('session-1')
    expect(h.driver.promptCalls[0]?.text).toContain('访客')
    expect(h.driver.promptCalls[0]?.text.endsWith('你好')).toBe(true)
    expect(h.driver.promptCalls[0]?.options?.actor).toBe('guest')
    const sink = h.channel.sinks[0]
    expect(sink?.finished).toEqual({ text: 'final reply', markdown: true })
  })

  it('owner prompts carry the owner actor tag', async () => {
    const h = await makeRouter()
    bindReady(h, 'ou_owner')
    h.channel.receive('你好', 'ou_owner')
    await settle()
    expect(h.driver.promptCalls[0]?.text).toContain('主人')
    expect(h.driver.promptCalls[0]?.options?.actor).toBe('owner')
  })

  it('streams live updates to the turn sink and finishes with markdown', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.channel.receive('写个函数')
    await settle()
    expect(h.channel.sinks.length).toBe(1)
    const sink = h.channel.sinks[0]!
    expect(sink.views).toEqual(['⏳ 正在思考…', '中间一段'])
    expect(sink.finished).toEqual({ text: 'final reply', markdown: true })
    expect(sink.failed).toBeUndefined()
  })

  it('routes prompt failures to sink.fail without throwing', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.driver.prompt = async () => { throw new Error('agent exploded') }
    h.channel.receive('你好')
    await settle()
    const sink = h.channel.sinks[0]!
    expect(sink.failed).toContain('agent exploded')
  })

  it('survives channel send failures (logged, no unhandled rejection)', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.channel.sendFails = true
    const onUnhandled = vi.fn()
    process.on('unhandledRejection', onUnhandled)
    h.channel.receive('/帮助')
    await settle()
    process.off('unhandledRejection', onUnhandled)
    expect(onUnhandled).not.toHaveBeenCalled()
    expect(h.logs.some(line => line.includes('发送到') && line.includes('失败'))).toBe(true)
  })

  it('honors the allowlist by silently ignoring strangers', async () => {
    const h = await makeRouter({ allow: from => from.userId === 'ou_user1' })
    bindReady(h, 'ou_user1')
    h.channel.receive('你好', 'ou_stranger')
    await settle()
    expect(h.channel.sent.length).toBe(0)
    expect(h.driver.promptCalls.length).toBe(0)
    expect(h.logs.some(line => line.includes('拒绝未授权用户'))).toBe(true)
  })

  it('remembers the chat target for proactive sends', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.channel.receive('你好')
    await settle()
    expect(h.store.rows.get('feishu:ou_user1')?.targetId).toBe('ou_user1')
  })
})

describe('router lazy session resume', () => {
  it('re-attaches the owner avatar session before prompting', async () => {
    const h = await makeRouter()
    h.store.bind({ kind: 'feishu', userId: 'ou_user1' }, 'session-9', true)
    h.store.selectWorkspace({ kind: 'feishu', userId: 'ou_user1' }, 'E:\\proj')
    // session-9 is NOT in ownedIds: simulates a host restart.
    h.channel.receive('继续')
    await settle()
    expect(h.driver.resumed.length).toBe(1)
    expect(h.driver.resumed[0]?.sessionId).toBe('session-9')
    expect(h.driver.resumed[0]?.options?.cwd).toBe('E:\\proj')
    expect(h.driver.promptCalls[0]?.sessionId).toBe('session-9')
  })

  it('rebuilds the avatar for the owner when resume fails and guests follow', async () => {
    const h = await makeRouter()
    h.store.bind({ kind: 'feishu', userId: 'ou_user1' }, 'session-9', true)
    h.store.selectWorkspace({ kind: 'feishu', userId: 'ou_user1' }, 'E:\\proj')
    h.driver.resumeFails = true
    h.channel.receive('继续', 'ou_guest')
    await settle()
    // Resume was attempted; failing it must not strand anyone — the owner's
    // anchor is rebuilt and the guest's prompt runs on the fresh session.
    expect(h.driver.resumed.length).toBe(1)
    expect(h.driver.started.length).toBe(1)
    expect(h.driver.promptCalls.length).toBe(1)
    expect(h.store.ownerFor('feishu')?.sessionId).toBe(h.driver.promptCalls[0]?.sessionId)
    const sink = h.channel.sinks[0]
    expect(sink?.finished).toEqual({ text: 'final reply', markdown: true })
  })
})

describe('router verbosity → turn mode', () => {
  it('opens quiet turns for 简洁', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.store.setVerbosity({ kind: 'feishu', userId: 'ou_user1' }, '简洁')
    h.channel.receive('你好')
    await settle()
    expect(h.channel.openModes).toEqual(['quiet'])
  })

  it('opens verbose turns after /回复 详细', async () => {
    const h = await makeRouter()
    bindReady(h)
    h.channel.receive('/回复 详细')
    await settle()
    expect(h.channel.sent.some(m => m.text.includes('详细'))).toBe(true)
    h.channel.receive('你好')
    await settle()
    expect(h.channel.openModes).toEqual(['verbose'])
    expect(h.driver.promptCalls[0]?.options?.verbosity).toBe('详细')
  })
})

describe('router command gating (digital avatar)', () => {
  it('anyone can claim an unowned channel via /bind', async () => {
    const h = await makeRouter()
    h.channel.receive('/bind', 'ou_first')
    await settle()
    expect(h.driver.started.length).toBe(1)
    expect(h.store.ownerFor('feishu')?.userId).toBe('ou_first')
    expect(h.channel.sent.some(m => m.text.includes('认领成功'))).toBe(true)
  })

  it('a second /bind from another user is rejected', async () => {
    const h = await makeRouter()
    bindReady(h, 'ou_owner')
    h.channel.receive('/bind', 'ou_other')
    await settle()
    expect(h.channel.sent.some(m => m.text.includes('已由 Owner 绑定'))).toBe(true)
    expect(h.driver.started.length).toBe(0)
    expect(h.store.ownerFor('feishu')?.userId).toBe('ou_owner')
  })

  it('guests cannot run management commands', async () => {
    const h = await makeRouter()
    bindReady(h, 'ou_owner')
    for (const command of ['/项目', '/模型', '/思考', '/新建', '/unbind']) {
      h.channel.receive(command, 'ou_guest')
      await settle()
    }
    expect(h.driver.started.length).toBe(0)
    expect(h.channel.sent.filter(m => m.text.includes('仅 Owner 可用')).length).toBe(5)
  })

  it('guests can run the default guest commands', async () => {
    const h = await makeRouter()
    bindReady(h, 'ou_owner')
    h.channel.receive('/帮助', 'ou_guest')
    await settle()
    expect(h.channel.sent.some(m => m.text.includes('机器人命令'))).toBe(true)
    h.channel.receive('/停止', 'ou_guest')
    await settle()
    expect(h.channel.sent.some(m => m.text.includes('没有正在执行的任务'))).toBe(true)
  })

  it('management commands hint setup on an unowned channel', async () => {
    const h = await makeRouter()
    h.channel.receive('/项目')
    await settle()
    expect(h.channel.sent.some(m => m.text.includes('尚未初始化'))).toBe(true)
  })
})
