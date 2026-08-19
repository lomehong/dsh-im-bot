/**
 * Owner-reply approval bridge tests: keyword parsing, pending lifecycle
 * (request → owner reply → decision), timeout fail-closed, and delivery
 * failure — all against the pure coordinator with a fake notifier.
 */
import { describe, expect, it, vi } from 'vitest'
import { ApprovalBridge, APPROVAL_TIMEOUT_MS, parseApprovalReply } from '../src/plugin/approval-bridge.ts'

describe('parseApprovalReply', () => {
  it('maps bilingual keywords to decisions', () => {
    expect(parseApprovalReply('允许')).toBe('allowed-once')
    expect(parseApprovalReply(' Y ')).toBe('allowed-once')
    expect(parseApprovalReply('allow')).toBe('allowed-once')
    expect(parseApprovalReply('拒绝')).toBe('rejected')
    expect(parseApprovalReply('n')).toBe('rejected')
  })

  it('leaves ordinary chat untouched', () => {
    expect(parseApprovalReply('帮我看看那个问题')).toBeUndefined()
    expect(parseApprovalReply('')).toBeUndefined()
    expect(parseApprovalReply('这句话特别长肯定不是审批关键词')).toBeUndefined()
  })
})

function makeBridge(delivered = true): { bridge: ApprovalBridge; sent: Array<{ kind: string; userId: string; text: string }> } {
  const sent: Array<{ kind: string; userId: string; text: string }> = []
  const bridge = new ApprovalBridge(async (kind, userId, text) => {
    sent.push({ kind, userId, text })
    return delivered
  })
  return { bridge, sent }
}

describe('ApprovalBridge', () => {
  it('delivers the card to the owner and resolves on their reply', async () => {
    const { bridge, sent } = makeBridge()
    const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: '列出目录' })
    expect(bridge.hasPending('feishu')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(sent[0]?.text).toContain('bash')
    expect(sent[0]?.userId).toBe('ou_owner')
    const consumed = bridge.consumeOwnerReply('feishu', 'ou_owner', ' 允许 ')
    expect(consumed).toBe(true)
    await expect(decision).resolves.toBe('allowed-once')
    // 决策后的确认回执
    expect(sent.some(s => s.text.includes('已允许'))).toBe(true)
    expect(bridge.hasPending('feishu')).toBe(false)
  })

  it('only the owner of the pending channel can decide; others pass through', async () => {
    const { bridge } = makeBridge()
    const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
    expect(bridge.consumeOwnerReply('feishu', 'ou_other', '允许')).toBe(false)
    expect(bridge.consumeOwnerReply('wecom', 'ou_owner', '允许')).toBe(false)
    expect(bridge.consumeOwnerReply('feishu', 'ou_owner', '拒绝')).toBe(true)
    await expect(decision).resolves.toBe('rejected')
  })

  it('non-keyword owner replies are not consumed', async () => {
    const { bridge } = makeBridge()
    const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
    expect(bridge.consumeOwnerReply('feishu', 'ou_owner', '先等一下')).toBe(false)
    expect(bridge.hasPending('feishu')).toBe(true)
    bridge.consumeOwnerReply('feishu', 'ou_owner', 'y')
    await expect(decision).resolves.toBe('allowed-once')
  })

  it('rejects when the card cannot be delivered', async () => {
    const { bridge } = makeBridge(false)
    await expect(bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined }))
      .resolves.toBe('rejected')
  })

  it('times out fail-closed when the owner never replies', async () => {
    vi.useFakeTimers()
    try {
      const { bridge } = makeBridge()
      const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
      vi.advanceTimersByTime(APPROVAL_TIMEOUT_MS + 1_000)
      await expect(decision).resolves.toBe('rejected')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a second request on the same channel supersedes the first (rejected)', async () => {
    const { bridge } = makeBridge()
    const first = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
    const second = bridge.request('feishu', 'ou_owner', '访客乙', { toolName: 'pwsh', reason: undefined })
    await expect(first).resolves.toBe('rejected')
    bridge.consumeOwnerReply('feishu', 'ou_owner', '允许')
    await expect(second).resolves.toBe('allowed-once')
  })
})

describe('ApprovalBridge button cards', () => {
  it('sends a token-linked card; the owner click resolves the decision', async () => {
    const cards: Array<{ kind: string; userId: string; token: string }> = []
    const bridge = new ApprovalBridge(
      async () => true,
      async (kind, userId, card) => { cards.push({ kind, userId, token: card.token }); return true },
    )
    const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
    // 等待卡片登记 token（异步 sendCard）
    await new Promise(resolve => setTimeout(resolve, 10))
    const token = cards[0]?.token
    expect(token).toBeDefined()
    // 非 Owner 点击被忽略
    expect(bridge.resolveByToken('feishu', token, 'allow', 'ou_other')).toBe(false)
    // 错渠道被忽略
    expect(bridge.resolveByToken('wecom', token, 'allow', 'ou_owner')).toBe(false)
    const settled: string[] = []
    expect(bridge.resolveByToken('feishu', token, 'deny', 'ou_owner', async outcome => { settled.push(outcome) })).toBe(true)
    await expect(decision).resolves.toBe('rejected')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(settled).toEqual(['rejected'])
  })

  it('card and text paths race; first decision wins', async () => {
    const bridge = new ApprovalBridge(async () => true, async () => true)
    const decision = bridge.request('feishu', 'ou_owner', '访客甲', { toolName: 'bash', reason: undefined })
    await new Promise(resolve => setTimeout(resolve, 10))
    // 卡片路径尚未点击时，Owner 文本回复 允许 也应生效并终结
    expect(bridge.consumeOwnerReply('feishu', 'ou_owner', '允许')).toBe(true)
    await expect(decision).resolves.toBe('allowed-once')
    // 迟到的 token 点击不再生效
    expect(bridge.resolveByToken('feishu', 'whatever', 'deny', 'ou_owner')).toBe(false)
  })

  it('falls back to text card when the channel cannot send cards', async () => {
    const sent: string[] = []
    const bridge = new ApprovalBridge(async (_k, _u, text) => { sent.push(text); return true }, async () => false)
    const decision = bridge.request('wechat', 'wx_owner', '访客甲', { toolName: 'bash', reason: undefined })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(sent[0]).toContain('回复「允许」或「拒绝」')
    bridge.consumeOwnerReply('wechat', 'wx_owner', 'y')
    await expect(decision).resolves.toBe('allowed-once')
  })
})
