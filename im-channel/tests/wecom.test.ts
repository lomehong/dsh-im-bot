/**
 * WeCom channel lifecycle tests: connect idempotency (no zombie WSClient),
 * authentication-gated bring-up (waitAuthenticated), and reconnect that only
 * resolves once authenticated. The SDK is faked (events emitted manually)
 * and fs is redirected to a per-test temp HOME for the credentials file.
 *
 * Regression context: after saving credentials at runtime the channel used to
 * report "connected" without ever authenticating — WeCom only pushes messages
 * to the authenticated active connection, so /bind stayed silent until a
 * restart. These tests pin down the verified bring-up contract.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const tempHome = mkdtempSync(join(tmpdir(), 'im-channel-wecom-'))
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => tempHome }
})

/** Shared registry so tests can reach the fake clients created by the channel. */
const { fakeState } = vi.hoisted(() => ({
  fakeState: { instances: [] as FakeWSClient[] },
}))

class FakeWSClient {
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  connectCalls = 0
  disconnectCalls = 0
  constructor(readonly options: unknown) {
    fakeState.instances.push(this)
  }
  on(event: string, handler: (...args: unknown[]) => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(handler)
    this.listeners.set(event, list)
  }
  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) handler(...args)
  }
  connect(): void { this.connectCalls += 1 }
  disconnect(): void { this.disconnectCalls += 1 }
}

vi.mock('@wecom/aibot-node-sdk', () => ({
  WSClient: FakeWSClient,
  DefaultLogger: class { constructor(_tag?: string) {} },
  decryptFile: (buffer: Buffer): Buffer => buffer,
}))

const { WecomChannel, saveWecomCredentials } = await import('../src/channels/wecom/index.ts')

/** Let queued microtasks (connect → waitAuthenticated registration) run. */
async function settle(ms = 5): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

const latestClient = (): FakeWSClient => {
  const client = fakeState.instances.at(-1)
  if (client === undefined) throw new Error('no WSClient created')
  return client
}

beforeEach(() => {
  fakeState.instances.length = 0
  saveWecomCredentials({ botId: 'bot-test', secret: 'secret-test' })
})

afterAll(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe('wecom connect idempotency', () => {
  it('a second connect() tears down the old client first (no zombie connection)', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    const first = latestClient()
    await channel.connect()
    const second = latestClient()
    expect(fakeState.instances.length).toBe(2)
    // 旧连接必须被彻底断开——企微单活跃连接模型下僵尸连接会踢新连接。
    expect(first.disconnectCalls).toBe(1)
    expect(second.disconnectCalls).toBe(0)
    expect((channel as unknown as { client: FakeWSClient }).client).toBe(second)
    await channel.stop()
  })

  it('stop() disconnects the client and clears timers', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    const client = latestClient()
    await channel.stop()
    expect(client.disconnectCalls).toBe(1)
    expect((channel as unknown as { client: FakeWSClient | undefined }).client).toBeUndefined()
  })
})

describe('wecom waitAuthenticated (拉起验证)', () => {
  it('resolves once the authenticated event fires', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    const waiting = channel.waitAuthenticated(1_000)
    latestClient().emit('authenticated')
    await expect(waiting).resolves.toBeUndefined()
    await channel.stop()
  })

  it('resolves immediately when already authenticated', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    latestClient().emit('authenticated')
    await expect(channel.waitAuthenticated(50)).resolves.toBeUndefined()
    await channel.stop()
  })

  it('rejects on timeout when authentication never happens', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    // 「socket 建上了」不等于上线：未认证必须显式失败，而不是假装在线。
    await expect(channel.waitAuthenticated(30)).rejects.toThrow(/等待认证超时/)
    await channel.stop()
  })

  it('rejects and reports dead after repeated auth failures (bad credentials)', async () => {
    const channel = new WecomChannel()
    const dead: string[] = []
    channel.onDead(reason => { dead.push(reason) })
    await channel.connect()
    const waiting = channel.waitAuthenticated(2_000)
    for (let i = 0; i < 5; i++) latestClient().emit('error', new Error('auth refused'))
    await expect(waiting).rejects.toThrow(/认证持续失败/)
    expect(dead.length).toBe(1)
    await channel.stop()
  })

  it('transient errors after a successful auth do not count as failures', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    latestClient().emit('authenticated')
    for (let i = 0; i < 10; i++) latestClient().emit('error', new Error('network blip'))
    // 已认证状态下错误不影响认证状态；再等仍然立即通过。
    await expect(channel.waitAuthenticated(50)).resolves.toBeUndefined()
    await channel.stop()
  })

  it('a disconnect drops the authenticated state', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    latestClient().emit('authenticated')
    latestClient().emit('disconnected', 'kicked by new connection')
    await expect(channel.waitAuthenticated(30)).rejects.toThrow(/等待认证超时/)
    await channel.stop()
  })

  it('stop() rejects pending waiters', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    const waiting = channel.waitAuthenticated(2_000)
    await settle()
    await channel.stop()
    await expect(waiting).rejects.toThrow(/已被停止/)
  })
})

describe('wecom reconnect (凭证热替换)', () => {
  it('replaces the old connection and resolves only after authentication', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    latestClient().emit('authenticated')
    const first = latestClient()

    const reconnecting = channel.reconnect()
    await settle()
    const second = latestClient()
    expect(second).not.toBe(first)
    expect(first.disconnectCalls).toBe(1)
    // 认证前 reconnect 未完成（拉起验证，而非「连上了就算」）。
    let done = false
    void reconnecting.then(() => { done = true })
    await settle()
    expect(done).toBe(false)
    second.emit('authenticated')
    await reconnecting
    expect(done).toBe(true)
    await channel.stop()
  })

  it('rejects when authentication keeps failing so callers can fall back to reload', async () => {
    const channel = new WecomChannel()
    await channel.connect()
    latestClient().emit('authenticated')
    const reconnecting = channel.reconnect()
    await settle()
    for (let i = 0; i < 5; i++) latestClient().emit('error', new Error('bad secret'))
    await expect(reconnecting).rejects.toThrow(/认证持续失败/)
    await channel.stop()
  })
})
