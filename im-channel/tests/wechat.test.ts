/**
 * WeChat channel tests: exercise the long-poll loop's dedup, backoff, and
 * dead-channel reporting. fetch is stubbed per-test (only getupdates responses
 * are scripted — notifystart returns a trivial ok), fs is redirected to a
 * per-test temp HOME so the cursor file never touches real disk.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tempHome = mkdtempSync(join(tmpdir(), 'im-channel-wechat-'))
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => tempHome }
})

const { WechatChannel, loadWechatCredentials, saveWechatCredentials } = await import('../src/channels/wechat/index.ts')

const CREDENTIALS = { botToken: 'token-abc', accountId: 'wx-id' }

interface QueuedResponse {
  ret?: number
  errcode?: number
  msgs?: Array<Record<string, unknown>>
  get_updates_buf?: string
}

/** Stub global fetch. notifystart always gets a trivial ok; getupdates
 *  responses come from the scripted queue. After the queue drains we honor
 *  the long-poll timeout (~35s) on the getupdates call so the loop blocks on
 *  fetch rather than spinning empty responses. stop()'s abort then resolves
 *  the in-flight getupdates with the standard AbortError. */
function stubFetch(getUpdatesResponses: Array<QueuedResponse | (() => Promise<QueuedResponse>)>): { calls: Array<{ url: string }> } {
  const calls: Array<{ url: string }> = []
  let queueIdx = 0
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString()
    calls.push({ url })
    // notifystart or any other endpoint → trivial success
    if (!url.includes('getupdates')) {
      return new Response(JSON.stringify({ ret: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }) as unknown as Response
    }
    const next = getUpdatesResponses[queueIdx++]
    if (next === undefined) {
      // Drained queue: behave like a real long-poll and wait for abort.
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return }
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      })
    }
    const body = typeof next === 'function' ? await next() : next
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }) as unknown as Response
  }) as unknown as typeof fetch)
  return { calls }
}

beforeEach(() => {
  saveWechatCredentials(CREDENTIALS)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => {
  try { rmSync(tempHome, { recursive: true, force: true }) } catch { /* OS temp cleaner will take it */ }
})

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('WechatChannel', () => {
  it('forwards one inbound message and updates context tokens', async () => {
    stubFetch([
      {
        ret: 0,
        msgs: [{
          from_user_id: 'wx_user_1',
          message_id: 'm-1',
          create_time_ms: 1,
          context_token: 'tok-1',
          item_list: [{ type: 1, text_item: { text: 'hello' } }],
        }],
        get_updates_buf: 'next-cursor',
      },
    ])
    const channel = new WechatChannel()
    const received: string[] = []
    channel.onMessage(message => received.push(message.text))
    await channel.connect()
    await sleep(50)
    await channel.stop()
    expect(received).toEqual(['hello'])
  })

  it('dedups redelivered messages by id and by recent fingerprint', async () => {
    // Same message id twice → deduped; same text within 30s from same user → deduped.
    stubFetch([
      { ret: 0, msgs: [{ from_user_id: 'wx_1', message_id: 'm-dup', create_time_ms: 1, item_list: [{ type: 1, text_item: { text: 'dup' } }] }], get_updates_buf: 'b1' },
      { ret: 0, msgs: [{ from_user_id: 'wx_1', message_id: 'm-dup', create_time_ms: 1, item_list: [{ type: 1, text_item: { text: 'dup' } }] }], get_updates_buf: 'b2' },
      { ret: 0, msgs: [{ from_user_id: 'wx_1', message_id: 'm-dup2', create_time_ms: 2, item_list: [{ type: 1, text_item: { text: 'dup' } }] }], get_updates_buf: 'b3' },
    ])
    const channel = new WechatChannel()
    const texts: string[] = []
    channel.onMessage(message => texts.push(message.text))
    await channel.connect()
    await sleep(80)
    await channel.stop()
    expect(texts).toEqual(['dup'])
  })

  it('reports dead on errcode=-14 and stops polling', async () => {
    stubFetch([{ ret: -14, errcode: -14, msgs: [] }])
    const channel = new WechatChannel()
    const deadReasons: string[] = []
    channel.onDead(reason => deadReasons.push(reason))
    await channel.connect()
    await sleep(80)
    await channel.stop()
    expect(deadReasons.some(r => r.includes('errcode=-14'))).toBe(true)
  })

  it('pruneStale drops context tokens idle past TTL and respects the size cap', () => {
    const channel = new WechatChannel()
    type Internal = { contextTokens: Map<string, string>; contextTokenActivity: Map<string, number>; recentFingerprints: Map<string, number>; pruneStale(): void }
    const internal = channel as unknown as Internal
    // Private static constants — peek via structural cast.
    const LIMITS = WechatChannel as unknown as { CONTEXT_TOKEN_TTL_MS: number; FINGERPRINT_WINDOW_MS: number }
    const now = Date.now()
    internal.contextTokens.set('active', 'tok-active')
    internal.contextTokens.set('stale', 'tok-stale')
    internal.contextTokenActivity.set('active', now)
    internal.contextTokenActivity.set('stale', now - LIMITS.CONTEXT_TOKEN_TTL_MS - 1000)
    internal.recentFingerprints.set('recent', now)
    internal.recentFingerprints.set('expired', now - LIMITS.FINGERPRINT_WINDOW_MS - 1000)
    internal.pruneStale()
    expect(internal.contextTokens.has('active')).toBe(true)
    expect(internal.contextTokens.has('stale')).toBe(false)
    expect(internal.contextTokenActivity.has('stale')).toBe(false)
    expect(internal.recentFingerprints.has('recent')).toBe(true)
    expect(internal.recentFingerprints.has('expired')).toBe(false)
  })

  it('isConfigured follows the saved credentials file', () => {
    expect(loadWechatCredentials()).toBeDefined()
    const channel = new WechatChannel()
    expect(channel.isConfigured()).toBe(true)
  })
})