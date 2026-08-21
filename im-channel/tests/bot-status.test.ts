import { describe, expect, it } from 'vitest'
import { collectBotStatus, type BotStatusDeps, type ImBotStatus } from '../src/core/bot-status.ts'
import type { ImChannel } from '../src/core/channel.ts'

/** 构造可注入的假依赖：给定各平台账号标识与绑定数。 */
function fakeDeps(accounts: Partial<Record<ImBotStatus['kind'], string>>, bound: Partial<Record<ImBotStatus['kind'], number>>): BotStatusDeps {
  return {
    accountOf: kind => accounts[kind],
    boundUsersOf: kind => bound[kind] ?? 0,
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
    }
    expect(bots.map(b => b.kind)).toEqual(['wechat', 'feishu', 'wecom'])
    expect(bots.map(b => b.label)).toEqual(['微信', '飞书', '企业微信'])
  })

  it('marks configured from credentials and online from running channel instances', () => {
    const deps = fakeDeps({ wechat: 'wx-acc-1', wecom: 'bot-42' }, { wechat: 2, wecom: 5 })
    const bots = collectBotStatus([channelOf('wechat')], deps)
    const byKind = Object.fromEntries(bots.map(b => [b.kind, b]))
    expect(byKind.wechat).toMatchObject({ configured: true, online: true, account: 'wx-acc-1', boundUsers: 2 })
    // 凭证存在但通道实例未建（如设置里停用）：已配置、离线
    expect(byKind.wecom).toMatchObject({ configured: true, online: false, account: 'bot-42', boundUsers: 5 })
    // 无凭证：未配置（即使有实例也不算 configured——防御性口径）
    expect(byKind.feishu).toMatchObject({ configured: false, online: false })
  })

  it('is online when a channel instance runs even without credentials (defensive)', () => {
    const bots = collectBotStatus([channelOf('feishu')], fakeDeps({}, {}))
    expect(bots.find(b => b.kind === 'feishu')?.online).toBe(true)
  })
})
