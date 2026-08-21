/**
 * IM 机器人状态汇总
 *
 * 供控制台右缘状态栏展示：每个平台（微信/飞书/企业微信）一张状态卡，
 * 报告「是否已配置凭证」「通道实例是否在运行」「账号标识」「绑定用户数」。
 *
 * 状态口径：
 *   - configured: 本地凭证文件存在（扫码登录 / 表单配置后落盘）
 *   - online:     router 当前持有该平台的通道实例（实例随设置重建，
 *                 存在即代表其连接循环在跑，失败会自动重连）
 *   - account:    凭证里的账号标识（微信 accountId / 飞书 appId / 企微 botId）
 *   - boundUsers: BindStore 中该平台已 /bind 的用户数
 */
import type { ImChannel } from './channel.ts'
import { BindStore } from './bind-store.ts'
import { loadWechatCredentials } from '../channels/wechat/index.ts'
import { loadFeishuCredentials } from '../channels/feishu/index.ts'
import { loadWecomCredentials } from '../channels/wecom/index.ts'

/** 单个平台的机器人状态 */
export interface ImBotStatus {
  kind: 'wechat' | 'feishu' | 'wecom'
  /** 平台中文名 */
  label: string
  /** 是否已配置凭证 */
  configured: boolean
  /** 通道实例是否在运行 */
  online: boolean
  /** 账号标识（accountId / appId / botId） */
  account: string | undefined
  /** 该平台已绑定的 IM 用户数 */
  boundUsers: number
  /** 该平台的绑定明细（Owner 在前，其余按绑定时间） */
  bindings: ImBotBinding[]
}

/** 一条绑定明细（用户标识已脱敏）。 */
export interface ImBotBinding {
  /** 脱敏后的用户标识（前 8 位 + …） */
  userId: string
  /** 是否 Owner（/bind 认领者） */
  isMaster: boolean
  /** 绑定时间（ISO） */
  boundAt: string
  /** 绑定的 harness 会话 id */
  sessionId: string
}

/** 用户标识脱敏：前 8 位 + 省略号（与设置页 Owner 展示同口径）。 */
export function maskUserId(userId: string): string {
  return userId.length <= 8 ? userId : `${userId.slice(0, 8)}…`
}

const KIND_LABELS: Record<ImBotStatus['kind'], string> = {
  wechat: '微信',
  feishu: '飞书',
  wecom: '企业微信',
}

/** 依赖注入面（测试可替换；生产默认走凭证加载器与 BindStore 单例）。 */
export interface BotStatusDeps {
  /** 读取各平台凭证，返回账号标识；不存在返回 undefined。 */
  accountOf: (kind: ImBotStatus['kind']) => string | undefined
  /** 该平台的绑定明细行（原始 Binding）。 */
  bindingsOf: (kind: ImBotStatus['kind']) => Array<{ userId: string, isMaster?: boolean, boundAt: string, sessionId: string }>
}

/** 生产依赖：凭证文件 + BindStore 单例。 */
export function defaultBotStatusDeps(): BotStatusDeps {
  return {
    accountOf: kind => {
      try {
        if (kind === 'wechat') return loadWechatCredentials()?.accountId
        if (kind === 'feishu') return loadFeishuCredentials()?.appId
        return loadWecomCredentials()?.botId
      } catch {
        return undefined
      }
    },
    bindingsOf: kind => {
      try {
        return (BindStore.shared as unknown as { rowsForListing(): Array<{ kind: string, userId: string, isMaster?: boolean, boundAt: string, sessionId: string }> })
          .rowsForListing()
          .filter(row => row.kind === kind)
          .map(row => ({ userId: row.userId, ...(row.isMaster !== undefined ? { isMaster: row.isMaster } : {}), boundAt: row.boundAt, sessionId: row.sessionId }))
      } catch {
        return []
      }
    },
  }
}

/**
 * 汇总三个平台的机器人状态。
 * @param channels router 当前持有的通道实例列表（undefined 时全部按离线计）
 * @param deps 可替换依赖（测试注入）
 */
export function collectBotStatus(
  channels: readonly ImChannel[] | undefined,
  deps: BotStatusDeps = defaultBotStatusDeps(),
): ImBotStatus[] {
  const running = new Set(channels?.map(c => c.kind) ?? [])
  return (Object.keys(KIND_LABELS) as Array<ImBotStatus['kind']>).map(kind => {
    const account = deps.accountOf(kind)
    // Owner 在前，其余按绑定时间升序；用户标识脱敏后出域。
    const bindings: ImBotBinding[] = deps.bindingsOf(kind)
      .slice()
      .sort((a, b) => (Number(b.isMaster ?? false) - Number(a.isMaster ?? false)) || a.boundAt.localeCompare(b.boundAt))
      .map(row => ({ userId: maskUserId(row.userId), isMaster: row.isMaster === true, boundAt: row.boundAt, sessionId: row.sessionId }))
    return {
      kind,
      label: KIND_LABELS[kind],
      configured: account !== undefined,
      online: running.has(kind),
      account,
      boundUsers: bindings.length,
      bindings,
    }
  })
}
