/**
 * QrPollCoordinator（企业微信扫码轮询 single-flight + 微缓存）单元测试。
 *
 * 回归背景：真机上企微外部扫码服务变慢时（每次 poll 挂满 10s 超时），客户端
 * 1.5~3s 一轮的无守卫轮询会在服务端堆起串行长队，占满浏览器每主机 6 连接，
 * 拖死整个设置页。协调器把同一 scode 的并发轮询折叠为一次外部请求，对刚落地
 * 的结果做 2.5s 微缓存，并保证成功后的副作用（存凭证 + 拉起通道）恰好一次。
 */
import { describe, expect, it } from 'vitest'
import { QrPollCoordinator } from '../src/plugin/qr-poll-coordinator.ts'
import type { WecomQrPoll } from '../src/channels/wecom/qr-auth.ts'

/** 手动时钟：测试里显式拨表，避免真实等待。 */
function fakeClock() {
  let now = 1_000_000
  return {
    now: (): number => now,
    advance: (ms: number): void => { now += ms },
  }
}

/** Deferred poll 假实现：手动放行结果，并记录外部调用次数。 */
function deferredPoll(result: WecomQrPoll | Error) {
  let calls = 0
  const pending: Array<{ resolve: (v: WecomQrPoll) => void; reject: (e: unknown) => void }> = []
  return {
    get calls(): number { return calls },
    fn: (_scode: string): Promise<WecomQrPoll> => new Promise<WecomQrPoll>((resolve, reject) => {
      calls += 1
      pending.push({ resolve: () => resolve(result as WecomQrPoll), reject: () => reject(result instanceof Error ? result : new Error('unreachable')) })
    }),
    settle: (): void => {
      for (const d of pending) { if (result instanceof Error) d.reject(result); else d.resolve(result) }
      pending.length = 0
    },
  }
}

/** 让 promise.then 链上的记录/清理微任务跑完。 */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('QrPollCoordinator single-flight（并发折叠）', () => {
  it('同一 scode 的并发轮询共享同一次外部请求', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'waiting' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const p1 = coordinator.pollOnce('s1')
    const p2 = coordinator.pollOnce('s1')
    const p3 = coordinator.pollOnce('s1')
    // 外部服务再慢也只发一次请求：3 个并发 = 1 次 poll。
    expect(poll.calls).toBe(1)
    poll.settle()
    const results = await Promise.all([p1, p2, p3])
    expect(results.length).toBe(3)
    for (const r of results) expect(r).toEqual({ status: 'waiting' })
    expect(poll.calls).toBe(1)
  })

  it('不同 scode 互不折叠', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'waiting' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    void coordinator.pollOnce('a')
    void coordinator.pollOnce('b')
    expect(poll.calls).toBe(2)
    poll.settle()
    await settle()
  })
})

describe('QrPollCoordinator 微缓存（2.5s）', () => {
  it('新落地的结果在 TTL 内直接回缓存，不再触发外部请求', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'waiting' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const first = coordinator.pollOnce('s1')
    poll.settle()
    await first
    clock.advance(1000)
    const cached = await coordinator.pollOnce('s1')
    expect(poll.calls).toBe(1)
    expect(cached).toEqual({ status: 'waiting' })
  })

  it('超过 TTL 后重新发起外部请求', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'waiting' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const first = coordinator.pollOnce('s1')
    poll.settle()
    await first
    clock.advance(2501)
    void coordinator.pollOnce('s1')
    expect(poll.calls).toBe(2)
    poll.settle()
    await settle()
  })
})

describe('QrPollCoordinator 终态清理', () => {
  it('expired/failed 落地即清缓存条目，下一轮重新 poll', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'expired' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const first = coordinator.pollOnce('s1')
    poll.settle()
    await first
    await settle()
    // 终态不留缓存：即便在 2.5s 内，下一次轮询也是新请求。
    void coordinator.pollOnce('s1')
    expect(poll.calls).toBe(2)
    poll.settle()
    await settle()
  })

  it('外部请求失败（如 10s 超时）作废条目，下一轮可重试', async () => {
    const clock = fakeClock()
    const poll = deferredPoll(new Error('timeout'))
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const first = coordinator.pollOnce('s1')
    poll.settle()
    await expect(first).rejects.toThrow('timeout')
    await settle()
    void coordinator.pollOnce('s1')
    expect(poll.calls).toBe(2)
    poll.settle()
    await settle()
  })
})

describe('QrPollCoordinator 副作用恰好一次（success）', () => {
  it('runExclusive 只由发起方链入一次，等待者等副作用完成后才拿到结果', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'success', botId: 'bot', secret: 'sec' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    const log: string[] = []
    let exclusiveDone = false
    const runExclusive = async (): Promise<void> => {
      log.push('exclusive-start')
      await new Promise(resolve => setTimeout(resolve, 5))
      exclusiveDone = true
      log.push('exclusive-done')
    }
    const p1 = coordinator.pollOnce('s1', runExclusive)
    const p2 = coordinator.pollOnce('s1', runExclusive)
    const p3 = coordinator.pollOnce('s1', runExclusive)
    poll.settle()
    const results = await Promise.all([p1, p2, p3])
    for (const r of results) expect(r).toEqual({ status: 'success', botId: 'bot', secret: 'sec' })
    expect(log).toEqual(['exclusive-start', 'exclusive-done'])
    expect(exclusiveDone).toBe(true)
    expect(poll.calls).toBe(1)
  })

  it('成功结果在 successHold 内长期缓存：不重复 poll、不重复副作用', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'success', botId: 'bot', secret: 'sec' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    let exclusiveCalls = 0
    const first = coordinator.pollOnce('s1', async () => { exclusiveCalls += 1 })
    poll.settle()
    await first
    clock.advance(10_000) // 远超 2.5s 微缓存，但仍在 successHold 内
    const again = await coordinator.pollOnce('s1', async () => { exclusiveCalls += 1 })
    expect(again).toEqual({ status: 'success', botId: 'bot', secret: 'sec' })
    expect(poll.calls).toBe(1)
    expect(exclusiveCalls).toBe(1)
  })

  it('runExclusive 失败时条目作废，下一轮重新 poll 并重试副作用', async () => {
    const clock = fakeClock()
    const poll = deferredPoll({ status: 'success', botId: 'bot', secret: 'sec' })
    const coordinator = new QrPollCoordinator(poll.fn, { now: clock.now })
    let attempts = 0
    const first = coordinator.pollOnce('s1', async () => {
      attempts += 1
      throw new Error('configure failed')
    })
    poll.settle()
    await expect(first).rejects.toThrow('configure failed')
    await settle()
    // 重试：重新 poll + 副作用再跑一次（这次成功）。
    const second = coordinator.pollOnce('s1', async () => { attempts += 1 })
    expect(poll.calls).toBe(2)
    poll.settle()
    await expect(second).resolves.toEqual({ status: 'success', botId: 'bot', secret: 'sec' })
    expect(attempts).toBe(2)
  })
})
