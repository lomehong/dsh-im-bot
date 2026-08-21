import { describe, expect, it } from 'vitest'
import { collectBotStatus, maskUserId, type BotStatusDeps, type ImBotStatus } from '../src/core/bot-status.ts'
import type { ImChannel } from '../src/core/channel.ts'

type BindingRow = { userId: string, isMaster?: boolean, boundAt: string, sessionId: string }

/** 构造可注入的假依赖：给定各平台账号标识与绑定行。 */
function fakeDeps(
  accounts: Partial<Record<ImBotStatus['kind'], string>>,
  bindings: Partial<Record<ImBotStatus['kind'], BindingRow[]>>,
): BotStatusDeps {
  return {
    accountOf: kind => accounts[kind],
    bindingsOf: kind => bindings[kind] ?? [],
  }
}

/** 假通道：只关心 kind。 */
function channelOf(kind: ImBotStatus['kind']): ImChannel {
  return { kind } as unknown as ImChannel
}

describe('collectBotStatus', () => {
  it('reports unconfigured + offline + zero bindings for an empty setup', () => {
    const bots = collectBotStatus(undefined, fakeDeps({}, {}))
    expect(bots).toHaveLength(3)
    for (const bot of bots) {
      expect(bot.configured).toBe(false)
      expect(bot.online).toBe(false)
      expect(bot.account).toBeUndefined()
      expect(bot.boundUsers).toBe(0)
      expect(bot.bindings).toEqual([])
    }
    expect(bots.map(b => b.kind)).toEqual(['wechat', 'feishu', 'wecom'])
    expect(bots.map(b => b.label)).toEqual(['微信', '飞书', '企业微信'])
  })

  it('marks configured from credentials and online from running channel instances', () => {
    const deps = fakeDeps(
      { wechat: 'wx-acc-1', wecom: 'bot-42' },
      {
        wechat: [{ userId: 'ou_user_with_long_id', isMaster: true, boundAt: '2026-01-01T00:00:00Z', sessionId: 's1' }, { userId: 'ou_guest', boundAt: '2026-01-02T00:00:00Z', sessionId: 's2' }],
        wecom: [{ userId: 'bot-owner', isMaster: true, boundAt: '2026-02-01T00:00:00Z', sessionId: 's3' }],
      },
    )
    const bots = collectBotStatus([channelOf('wechat')], deps)
    const byKind = Object.fromEntries(bots.map(b => [b.kind, b]))
    expect(byKind.wechat).toMatchObject({ configured: true, online: true, account: 'wx-acc-1', boundUsers: 2 })
    expect(byKind.wechat.bindings.map(b => b.isMaster)).toEqual([true, false])
    // 用户标识脱敏：前 8 位 + …
    expect(byKind.wechat.bindings[0]?.userId).toBe('ou_user_…')
    // 凭证存在但通道实例未建（如设置里停用）：已配置、离线
    expect(byKind.wecom).toMatchObject({ configured: true, online: false, account: 'bot-42', boundUsers: 1 })
    // 无凭证：未配置（即使有实例也不算 configured——防御性口径）
    expect(byKind.feishu).toMatchObject({ configured: false, online: false })
  })

  it('sorts bindings owner-first then by boundAt ascending', () => {
    const deps = fakeDeps({ feishu: 'cli_x' }, {
      feishu: [
        { userId: 'guest_early', boundAt: '2026-01-01T00:00:00Z', sessionId: 'a' },
        { userId: 'owner_late', isMaster: true, boundAt: '2026-03-01T00:00:00Z', sessionId: 'b' },
        { userId: 'guest_mid', boundAt: '2026-02-01T00:00:00Z', sessionId: 'c' },
      ],
    })
    const feishu = collectBotStatus(undefined, deps).find(b => b.kind === 'feishu')
    expect(feishu?.bindings.map(b => b.sessionId)).toEqual(['b', 'a', 'c'])
    expect(feishu?.bindings.map(b => b.isMaster)).toEqual([true, false, false])
  })

  it('is online when a channel instance runs even without credentials (defensive)', () => {
    const bots = collectBotStatus([channelOf('feishu')], fakeDeps({}, {}))
    expect(bots.find(b => b.kind === 'feishu')?.online).toBe(true)
  })
})

describe('maskUserId', () => {
  it('keeps short ids intact and truncates long ones with an ellipsis', () => {
    expect(maskUserId('ou_ab12')).toBe('ou_ab12')
    expect(maskUserId('ou_abcdefgh1234')).toBe('ou_abcde…')
    expect(maskUserId('12345678')).toBe('12345678')
  })
})
