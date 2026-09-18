/**
 * Mobile Connect client plugin, browser half. Registers the 手机连接 config
 * page on the im-channel bundle's Plugins-page entry (plugins.bundle.config):
 * platform cards with scan-code login (WeChat / Feishu / WeCom), binding
 * management, guest permissions, and MCP servers.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the plugin-manager SlotMap merge (the 'plugins.bundle.config' entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// Type-only: pulls the layout SlotMap merge (the 'shell.overlay' seat the rail renders into).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BotChannelTab, BotChannelPluginConfig } from './BotChannelTab.tsx'
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

  // 手机连接配置页：挂在 im-channel bundle 的插件详情页（配置本体属于 im-channel 插件）。
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: '@dsh-extra/im-channel',
  }, (props: { view: 'summary' | 'page' }) =>
    BotChannelPluginConfig({ view: props.view, t: (key) => t(key as ImKey) })))

  // 对话主区右缘的机器人状态竖栏（shell.overlay 加法座位，不占用详情栏槽位）。
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'im-bots-rail',
    order: 100,
    locale: NS,
    inject: (): ImBotsRailInjected => ({ t: key => t(key as ImKey) }),
  }, ImBotsRail))
}
