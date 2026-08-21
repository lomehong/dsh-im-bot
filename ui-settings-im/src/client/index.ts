/**
 * Mobile Connect settings plugin, browser half. Registers the "手机连接" tab
 * inside the Plugins settings section: platform cards with scan-code login
 * (WeChat / Feishu).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.plugins.tab' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls the layout SlotMap merge (the 'shell.overlay' seat the rail renders into).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BotChannelTab } from './BotChannelTab.tsx'
import type { BotChannelTabInjected } from './BotChannelTab.tsx'
import { ImBotsRail } from './ImBotsRail.tsx'
import type { ImBotsRailInjected } from './ImBotsRail.tsx'
import { en, zh, type ImKey } from './locales.ts'

export type { BotChannelTabInjected, BotChannelTabProps } from './BotChannelTab.tsx'
export { KINDS } from './store.ts'
export type { Kind } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 手机连接 tab copy. */
    'settings.im': ImKey
  }
}

const NS = 'settings.im'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-im: copy dictionaries')

  const t = ctx.locale.bind(NS) as (key: ImKey) => string
  const injected = (): BotChannelTabInjected => ({ t: key => t(key as ImKey) })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'bot-channel',
    order: 10,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, BotChannelTab))

  // 对话主区右缘的机器人状态竖栏（shell.overlay 加法座位，不占用详情栏槽位）。
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'im-bots-rail',
    order: 100,
    locale: NS,
    inject: (): ImBotsRailInjected => ({ t: key => t(key as ImKey) }),
  }, ImBotsRail))
}
