import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { BindStore } from '../core/bind-store.ts'
import { Router, type RouterStatus } from '../core/router.ts'
import { DEFAULT_GUEST_COMMANDS } from '../core/guest-permissions.ts'
import { HarnessDriver } from './driver.ts'
import { WechatChannel, loadWechatCredentials } from '../channels/wechat/index.ts'
import { FeishuChannel, loadFeishuCredentials } from '../channels/feishu/index.ts'
import { WecomChannel, loadWecomCredentials } from '../channels/wecom/index.ts'
import { WecomMcpRegistry } from '../channels/wecom/wecom-mcp-registry.ts'
import { getEnabledMcpServers } from '../channels/mcp-server-manager.ts'
import { LoginApi } from './login-api.ts'
import { ApprovalBridge } from './approval-bridge.ts'
import { QuestionBridge, type QuestionItem } from './question-bridge.ts'
import type { ChannelKind, ImChannel } from '../core/channel.ts'

export const name = 'im-channel'
export const inject = ['agents']
export const provide = ['im-channel']

const NS = settingsNamespace('im-channel')

/** One user-declared channel instance; key in the dict is the instance name. */
export interface ChannelInstanceConfig {
  kind: ChannelKind
  enabled: boolean
  displayName?: string
}

/** Resolved section shape persisted to ~/.dsh/settings.yaml under `im-channel:`. */
export interface ImChannelSection {
  channels: Record<string, ChannelInstanceConfig>
  commandPrefix: string
  /** Allowed IM user ids (or `kind:userId`); empty = everyone allowed. */
  allowlist: string[]
  /** 访客可用的工具模式列表（精确名或前缀通配 `foo*`）；空 = 访客纯对话。 */
  guestTools: string[]
  /** 访客可用的命令（canonical id）；默认帮助/状态/回复/停止。 */
  guestCommands: string[]
}

const KindUnion = z.union(['feishu', 'wechat', 'wecom'])

const InstanceSchema = z.object({
  kind: KindUnion,
  enabled: z.boolean().default(true),
  displayName: z.string().default(''),
})

export const Config = z.object({
  channels: z.dict(InstanceSchema).default({}),
  commandPrefix: z.string().default('/'),
  allowlist: z.array(z.string()).default([]),
  guestTools: z.array(z.string()).default([]),
  guestCommands: z.array(z.string()).default([...DEFAULT_GUEST_COMMANDS]),
}) as unknown as z<ImChannelSection>

function isCredentialled(kind: ChannelKind): boolean {
  switch (kind) {
    case 'wechat': return loadWechatCredentials() !== undefined
    case 'feishu': return loadFeishuCredentials() !== undefined
    case 'wecom': return loadWecomCredentials() !== undefined
  }
}

/** Build one channel instance from its declared config. */
function buildChannel(kind: ChannelKind, ctx: Context): ImChannel {
  const log = (line: string): void => { ctx.logger.info(line) }
  switch (kind) {
    case 'wechat': return new WechatChannel({ ctxLog: log })
    case 'feishu': return new FeishuChannel({ log })
    case 'wecom': return new WecomChannel({ log })
  }
}

export function apply(ctx: Context, config: ImChannelSection): void {
  // Browser-facing login routes: /im-channel/login/start and /status.
  ctx.inject(['webServer'], (wctx: Context) => {
    new LoginApi(wctx).register()
  })

  let current: ImChannelSection = config
  let router: Router | undefined
  let disposeRouter: (() => void) | undefined
  // 暴露 im-channel 服务：其他插件（如 yuyi）可主动推送消息到 IM 用户。
  // 路由在设置变更时会重建，服务通过闭包始终指向当前实例。
  ;(ctx as unknown as { provide: (name: string, value: unknown) => void }).provide('im-channel', {
    /**
     * 主动推送一条消息给指定渠道用户（须已绑定且记录过 lastTargetId）。
     * @returns 是否成功投递
     */
    pushToUser: (kind: 'feishu' | 'wechat' | 'wecom', userId: string, text: string, options?: { markdown?: boolean }): Promise<boolean> => {
      const r = router
      if (r === undefined) return Promise.resolve(false)
      return r.pushToUser(kind, userId, text, options)
    },
  })
  // One driver for the whole plugin lifetime: router rebuilds (settings
  // edits, instance reconciliation) must not orphan bound sessions — the
  // driver's owned-session map is what /bind hands out.
  const mcpRegistry = new WecomMcpRegistry()
  // 从通用 MCP 服务器管理中读取所有已启用的 MCP 服务器
  const enabledServers = getEnabledMcpServers()
  for (const server of enabledServers) {
    mcpRegistry.registerServer({ name: server.name, url: server.url })
  }
  // 访客工具审批桥：卡片推给渠道 Owner，等待其 IM 回复（允许/拒绝），
  // 超时 fail-closed。通知走当前 router 的 pushToUser（闭包延迟绑定）。
  // 审批卡片走渠道能力（飞书 interactive / 企微 template_card），
  // 按钮经同一条长连接回传；文本兜底只在卡片不可达时使用。
  const ownerTargetOf = (kind: string, ownerUserId: string): { kind: 'feishu' | 'wechat' | 'wecom'; targetId: string } | undefined => {
    const targetId = store.targetIdFor({ kind: kind as 'feishu' | 'wechat' | 'wecom', userId: ownerUserId as never })
    return targetId === undefined ? undefined : { kind: kind as 'feishu' | 'wechat' | 'wecom', targetId }
  }
  const channelOf = (kind: string): ImChannel | undefined => router?.channels.find(c => c.kind === kind)
  const approvalBridge = new ApprovalBridge(
    (kind, ownerUserId, body) => {
      const r = router
      if (r === undefined) return Promise.resolve(false)
      return r.pushToUser(kind as 'feishu' | 'wechat' | 'wecom', ownerUserId, body, { markdown: false })
    },
    async (kind, ownerUserId, card) => {
      const channel = channelOf(kind)
      const target = ownerTargetOf(kind, ownerUserId)
      if (channel?.sendApprovalCard === undefined || target === undefined) return false
      try {
        return await channel.sendApprovalCard(target, { ...card, reason: card.reason })
      } catch {
        return false
      }
    },
    line => { ctx.logger.info(`[im-channel] ${line}`) },
  )
  // 交互式提问桥：ask_user_question 的问题渲染到提问用户的 IM（编号选项），
  // 回复即答案。服务层面用「包装替换」：IM 会话走桥，其余会话委托原
  // provider（网页端），互不抢占（userQuestions 为单 provider 设计，
  // api-proxy 启动时已注册网页端）。
  const questionBridge = new QuestionBridge(
    (kind, userId, body) => {
      const r = router
      if (r === undefined) return Promise.resolve(false)
      return r.pushToUser(kind as 'feishu' | 'wechat' | 'wecom', userId, body, { markdown: false })
    },
    undefined,
    line => { ctx.logger.info(`[im-channel] ${line}`) },
  )
  const driver = new HarnessDriver(ctx, {
    mcpRegistry,
    guestTools: () => current.guestTools ?? [],
    // 非本插件驱动轮次的产出（schedule 提醒、yuyi 唤醒、竞态尾巴）
    // 主动推送到该会话绑定用户的 IM——网页端看得到的，手机上也看得到。
    onBackgroundMessage: (sessionId, messageText) => {
      const row = store.findBySession(sessionId)
      if (row === undefined) return
      const r = router
      if (r === undefined) return
      void r.pushToUser(row.kind, row.userId, messageText, { markdown: true }).then(delivered => {
        if (!delivered) ctx.logger.info(`[im-channel] 后台响应推送失败：${row.kind} ${row.userId.slice(0, 8)}… 无可达目标`)
      })
    },
    onUserQuestion: (sessionId, questions) => {
      const row = store.findBySession(sessionId)
      if (row === undefined) return Promise.reject(new Error('会话未绑定 IM 用户，无法经 IM 提问'))
      return questionBridge.ask(row.kind, row.userId, questions)
    },
    onOwnerApproval: ({ sessionId, toolName, reason, guestUserId }) => {
      const row = store.findBySession(sessionId)
      if (row === undefined) return Promise.resolve('rejected' as const)
      const owner = store.ownerFor(row.kind)
      if (owner === undefined) return Promise.resolve('rejected' as const)
      const label = guestUserId === undefined || guestUserId === 'unknown' ? row.userId.slice(0, 10) + '…' : guestUserId.slice(0, 16)
      return approvalBridge.request(row.kind, owner.userId, label, { toolName, reason })
    },
  })
  // One bind store for the whole plugin lifetime (and process-shared with
  // the login HTTP API): the bound-session rows must survive router
  // rebuilds, and /bind hands out new sessions from it.
  const store = BindStore.shared

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => { current = source() },
    onChange: () => {
      // Reconcile the live router against the declared instances: a changed
      // set, kind, or enabled flag restarts the router wholesale — channel
      // connections are cheap to re-establish relative to config edits.
      const next = current
      // A platform with saved credentials but no declared instance (e.g.
      // credentials persisted before this reconciliation existed, or settings
      // storage was reset) gets an auto-created instance so the bot actually
      // comes online after login. The settings service is optional at the
      // composition level, so reach it through a scoped inject.
      ctx.inject(['settings'], sctx => {
        void ensureInstancesForCredentials(sctx, next).catch(() => {})
      })
      if (router !== undefined && sameTopology(router, next)) return
      disposeRouter?.()
      router = undefined
      const channels: ImChannel[] = []
      for (const [name, instance] of Object.entries(next.channels)) {
        if (!instance.enabled) continue
        if (!isCredentialled(instance.kind)) {
          ctx.logger.warn(`im-channel: 实例 ${name}（${instance.kind}）缺少登录凭证，跳过；请先完成该平台的登录/配置`)
          continue
        }
        const channel = buildChannel(instance.kind, ctx)
        channels.push(channel)
      }
      if (channels.length === 0) return
      router = new Router({
        channels,
        driver,
        store,
        config: { commandPrefix: next.commandPrefix },
        log: (line: string): void => { ctx.logger.info(line) },
        allowed: (from): boolean => {
          const list = current.allowlist
          if (list === undefined || list.length === 0) return true
          return list.includes(from.userId) || list.includes(`${from.kind}:${from.userId}`)
        },
        guestCommands: (): readonly string[] => current.guestCommands ?? DEFAULT_GUEST_COMMANDS,
        approval: {
          consumeOwnerReply: (kind, ownerUserId, messageText) => approvalBridge.consumeOwnerReply(kind, ownerUserId, messageText),
          resolveByToken: (kind, token, decision, userId, settleCard) => approvalBridge.resolveByToken(kind, token, decision, userId, settleCard),
        },
        question: {
          consumeReply: (kind: 'feishu' | 'wechat' | 'wecom', userId: string, messageText: string, commandPrefix: string) => questionBridge.consumeReply(kind, userId, messageText, commandPrefix),
        },
        usageOf: sessionId => driver.usageOf(sessionId),
        compact: sessionId => driver.compact(sessionId),
        steer: (sessionId, instruction) => driver.steer(sessionId, instruction),
        status: (): RouterStatus => {
          const selection = ctx.get('agentDefaultModel')
          if (selection !== undefined) {
            const value = selection.currentSelection() as { provider: string; model: string; reasoningEffort?: string }
            const facts: RouterStatus = { cwd: process.cwd(), provider: value.provider, model: value.model }
            if (value.reasoningEffort !== undefined) facts.reasoningEffort = value.reasoningEffort
            return facts
          }
          return { cwd: process.cwd(), provider: '-', model: '-' }
        },
        workspaces: () => {
          const registry = ctx.get('workspaceRegistry')
          if (registry === undefined) return []
          return registry.list().map((w: { path: string; title: string }) => ({ path: w.path, title: w.title }))
        },
        models: async () => {
          const llm = ctx.get('llm')
          if (llm === undefined) return []
          const choices: Array<{ provider: string; model: string; label: string }> = []
          for (const provider of llm.listProviders()) {
            try {
              const models = await llm.listModels(provider.id)
              for (const m of models) choices.push({ provider: provider.id, model: m.id, label: m.id })
            } catch {
              // Provider without a discoverable catalog is skipped.
            }
          }
          return choices
        },
        cancel: sessionId => driver.cancel(sessionId),
        efforts: async () => {
          const llm = ctx.get('llm')
          const selection = ctx.get('agentDefaultModel')
          if (llm === undefined || selection === undefined) return []
          const value = selection.currentSelection() as { provider: string; model: string }
          if (value.provider === '' || value.model === '') return []
          try {
            const info = await llm.resolveModelInfo(value.provider, value.model)
            return info.reasoning?.efforts.map(e => ({ id: e.id as string, name: e.name })) ?? []
          } catch {
            return []
          }
        },
        setDefaultModel: async patch => {
          const service = ctx.get('agentDefaultModel')
          if (service === undefined) throw new Error('agentDefaultModel 服务不可用')
          const current = service.currentSelection() as { provider: string; model: string; reasoningEffort?: string }
          await service.saveSelection({
            provider: patch.provider ?? current.provider,
            model: patch.model ?? current.model,
            ...patch.reasoningEffort === undefined && current.reasoningEffort === undefined
              ? {}
              : { reasoningEffort: patch.reasoningEffort ?? current.reasoningEffort },
          })
        },
      })
      void ctx.effect(async function* () {
        await router?.start()
        yield () => { void router?.stop() }
      }, 'im-channel.router')
      disposeRouter = () => { void router?.stop(); router = undefined }
    },
  })
}

/** Whether the live router already serves exactly this topology. */
function sameTopology(router: Router, next: ImChannelSection): boolean {
  const live = router.channels
  const wanted = Object.entries(next.channels)
    .filter(([, instance]) => instance.enabled)
    .map(([, instance]) => instance.kind)
    .sort()
  const liveKinds = live.map(channel => channel.kind).sort()
  return liveKinds.length === wanted.length && liveKinds.every((kind, index) => kind === wanted[index])
}

/** Auto-create instances for platforms that have credentials but no row. */
async function ensureInstancesForCredentials(ctx: Context, next: ImChannelSection): Promise<void> {
  const KIND_LABELS: Record<ChannelKind, string> = { wechat: '微信', feishu: '飞书', wecom: '企业微信' }
  const patch: Record<string, { kind: ChannelKind; enabled: boolean; displayName: string }> = {}
  let changed = false
  for (const kind of ['wechat', 'feishu', 'wecom'] as const) {
    if (!isCredentialled(kind)) continue
    const sameKind = Object.entries(next.channels).filter(([, v]) => v.kind === kind)
    if (sameKind.length > 0) continue
    const name = `${kind}-1`
    patch[name] = { kind, enabled: true, displayName: `${KIND_LABELS[kind]}机器人 1` }
    changed = true
  }
  if (!changed) return
  try {
    await ctx.settings.update(NS, { channels: patch })
  } catch (error) {
    ctx.logger.warn(`im-channel: 为已登录平台自动创建实例失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}
