import type { Context } from '@deepseek-ai/cordis'
// 纯类型导入：载入 @deepseek-ai/dsh-settings 对 Context 的 `.settings` 增补。
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { TaskDecisionBridge } from './task-decision-bridge.ts'
import { BindStore } from '../core/bind-store.ts'
import { Router, type RouterStatus } from '../core/router.ts'
import { DEFAULT_GUEST_COMMANDS } from '../core/guest-permissions.ts'
import { collectBotStatus, type ImBotStatus } from '../core/bot-status.ts'
import { HarnessDriver } from './driver.ts'
import { WechatChannel, loadWechatCredentials } from '../channels/wechat/index.ts'
import { FeishuChannel, loadFeishuCredentials } from '../channels/feishu/index.ts'
import { WecomChannel, loadWecomCredentials } from '../channels/wecom/index.ts'
import { WecomMcpRegistry } from '../channels/wecom/wecom-mcp-registry.ts'
import { getEnabledMcpServers, serverEntryToConfig } from '../channels/mcp-server-manager.ts'
import { LoginApi } from './login-api.ts'
import { createSectionView } from './section-view.ts'
import { ApprovalBridge } from './approval-bridge.ts'
import { answerForQuestion, QuestionBridge, questionText, type QuestionAnswer, type QuestionItem } from './question-bridge.ts'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { ChannelKind } from '../core/channel.ts'
import type { ImChannel } from '../core/index.ts'

export const name = 'im-channel'
export const inject = ['agents', 'tools']
export const provide = ['im-channel']

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
  /** 按回合记忆装配（可选增强，默认关）：dsh-memory assemblePack 逐回合注入 */
  memoryAssemblePerTurn?: boolean
  /** Allowed IM user ids (or `kind:userId`); empty = everyone allowed. */
  allowlist: string[]
  /** 访客可用的工具模式列表（精确名或前缀通配 `foo*`）；空 = 访客纯对话。 */
  guestTools: string[]
  /** 访客可用的命令（canonical id）；默认帮助/状态/回复/停止。 */
  guestCommands: string[]
  /** IM 会话显式使用的 agent 预设 id；空 = 跟随全局默认预设。 */
  agentPreset: string
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
  /** 按回合记忆装配（可选增强，默认关）：开启后每条用户消息派发前注入相关记忆包 */
  memoryAssemblePerTurn: z.boolean().default(false),
  allowlist: z.array(z.string()).default([]),
  guestTools: z.array(z.string()).default([]),
  guestCommands: z.array(z.string()).default([...DEFAULT_GUEST_COMMANDS]),
  /** 分身会话的审批策略：默认 ask（敏感操作需 Owner 审批），比全局 never 更严。 */
  approval: z.union(['ask', 'never']).default('ask'),
  /** IM 会话显式使用的 agent 预设 id（如 'digital-twin'）；空 = 跟随全局默认预设。
   *  设它可把 IM 侧人格与全局默认解耦：主人日常会话用 standard，IM 稳定走分身。 */
  agentPreset: z.string().default(''),
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
  // stdout 双写：ctx.logger.info 在该 profile 下不落盘，渠道层错误曾因此静默。
  const log = (line: string): void => {
    process.stdout.write(`[im-channel] ${line}
`)
    try { ctx.logger.info(line) } catch { /* ignore */ }
  }
  switch (kind) {
    case 'wechat': return new WechatChannel({ ctxLog: log })
    case 'feishu': return new FeishuChannel({ log })
    case 'wecom': return new WecomChannel({ log })
  }
}

export function apply(ctx: Context, config: ImChannelSection): void {
  // 配置节视图：0.1.7 契约下配置权威 = Loader 注入的 apply(config)，
  // 插件重载（configEditor 应用条目配置）即重入 apply、读到最新。
  const section = createSectionView<ImChannelSection>(config)
  // Browser-facing login routes: /im-channel/login/start and /status.
  // 0.1.7 契约（docs/migration-0.1.7.md §4-T3）：根 ctx 管服务读取、
  // scoped 只取 webServer 句柄、配置读取走节视图——不再在子上下文上
  // inject(['settings'])（settings.get 已移除，回调抛错曾致路由挂起）。
  ctx.inject(['webServer'], (wctx: Context) => {
    const scoped = wctx as unknown as { webServer?: import('./login-api.ts').RouteWeb }
    new LoginApi(ctx, scoped, section).register()
  })

  let router: Router | undefined
  let disposeRouter: (() => void) | undefined
  /** P1.5 通用主人回复拦截器（跨插件注册；路由重建共享同一数组引用）。 */
  const ownerReplyInterceptors: Array<(kind: 'feishu' | 'wechat' | 'wecom', ownerUserId: string, text: string) => boolean> = []
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
    /** 三平台机器人状态汇总（控制台右缘状态栏数据源）。 */
    botsStatus: (): ImBotStatus[] => collectBotStatus(router?.channels),
    /** P1.5 通用主人回复拦截器注册（task-board 审批等跨插件语义；回调异常按未消费处理）。
     *  返回注销函数。 */
    registerOwnerReplyInterceptor(fn: (kind: 'feishu' | 'wechat' | 'wecom', ownerUserId: string, text: string) => boolean): () => void {
      ownerReplyInterceptors.push(fn)
      return () => {
        const i = ownerReplyInterceptors.indexOf(fn)
        if (i >= 0) ownerReplyInterceptors.splice(i, 1)
      }
    },
    /** P1.5 主人绑定的 IM 渠道清单（未脱敏——仅宿主侧插件内部推送用；
     *  0.2.2 修复：collectBotStatus 会脱敏 userId，脱敏 id 推送不可达（生产已踩）。
     *  改直读 BindStore ownerFor，且仅保留已记住推送目标（targetIdFor）的渠道。 */
    masterTargets(): Array<{ kind: 'feishu' | 'wechat' | 'wecom'; userId: string }> {
      const out: Array<{ kind: 'feishu' | 'wechat' | 'wecom'; userId: string }> = []
      for (const kind of ['feishu', 'wechat', 'wecom'] as const) {
        if (router?.channels.find(ch => ch.kind === kind) === undefined) continue
        const owner = store.ownerFor(kind)
        if (owner === undefined || owner.userId === '') continue
        if (store.targetIdFor({ kind, userId: owner.userId as never }) === undefined) continue
        out.push({ kind, userId: owner.userId })
      }
      return out
    },
    /** P1.5 任务决策卡（task-board 阻断式审批）：推送批准/拒绝按钮卡（文本兜底），
     *  点击/回复任意一路即决；返回决策 promise（无超时 fail-closed）。 */
    requestTaskApproval(info: { taskId: string; title: string; level: string; summary: string }): Promise<'approved' | 'rejected'> {
      return taskBridge.request(info)
    },
    /** 决策已在别处完成（控制台/拦截器/主人会话）→ 撤销待决任务卡。 */
    cancelTaskApproval(taskId: string): boolean {
      return taskBridge.cancel(taskId)
    },
    /**
     * 按当前声明实例强制重建路由。用于「凭证后到」场景（登录/配置保存时
     * 实例行已存在，settings 值不变不会触发 onChange）：冷启动的通道
     * 由这里拉起，不依赖重启。
     */
    reload: (): void => {
      rebuildRouter()
      // MCP server 增删改后重同步全局工具注册（不依赖重启）
      void mcpRegistry.resyncGlobal(ctx).catch(() => {})
    },
  })

  // 分身投递通路（§6.1 单向注册）：dsh-mind 的 share/主动找主人经此送达
  // 主人绑定（dsh-mind 缺席 → 不注册，零回归）。到主人=第一个主人绑定。
  ctx.inject(['dsh-mind'], (mctx: Context) => {
    const mind = mctx.get('dsh-mind') as
      | { registerChannel?(ch: { id: string; deliver(payload: { to: string; text: string; refs?: Record<string, string> }): Promise<boolean> | boolean }): () => void }
      | undefined
    if (mind?.registerChannel === undefined) return
    mind.registerChannel({
      id: 'im-channel',
      deliver: (payload) => {
        if (payload.to !== 'master') return false // P2 只支持送达主人
        const r = router
        if (r === undefined) return false
        for (const bot of collectBotStatus(r.channels)) {
          for (const b of bot.bindings) {
            if (b.isMaster === true && typeof b.userId === 'string' && b.userId !== '') {
              return r.pushToUser(bot.kind, b.userId, payload.text, { markdown: true })
            }
          }
        }
        return false // 主人未绑定 IM
      },
    })
  })
  // One driver for the whole plugin lifetime: router rebuilds (settings
  // edits, instance reconciliation) must not orphan bound sessions — the
  // driver's owned-session map is what /bind hands out.
  const mcpRegistry = new WecomMcpRegistry()
  // 从通用 MCP 服务器管理中读取所有已启用的 MCP 服务器
  const enabledServers = getEnabledMcpServers()
  for (const server of enabledServers) {
    mcpRegistry.registerServer(serverEntryToConfig(server))
  }
  // 全局注册 MCP 工具：注册到宿主根 tools 层，使任何通道（Web / IM /
  // headless / 子代理）创建的 agent 会话都能直接调用。生命周期跟随插件
  // ctx——插件卸载时自动注销。
  void ctx.effect(async function* () {
    await mcpRegistry.registerGlobal(ctx)
    yield () => mcpRegistry.disposeGlobal()
  }, 'im-channel.mcp-global')
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
      // 双路日志（console + logger），logger.info 在 cordis 严格类型下可能不打印。
      const log = (line: string) => {
        process.stdout.write(`[im-channel] ${line}
`)
        try { (ctx.logger as { info?: (s: string) => void }).info?.(`[im-channel] ${line}`) } catch { /* ignore */ }
      }
      const hasChannel = channel !== undefined
      const hasSendApprovalCard = typeof channel?.sendApprovalCard === 'function'
      const hasTarget = target !== undefined
       ctx.logger?.info?.(`sendCard check: kind=${kind} hasChannel=${hasChannel} hasSendApprovalCard=${hasSendApprovalCard} target=${hasTarget}`)
      if (!hasChannel || !hasSendApprovalCard || !hasTarget) return false
      // fn.call 绑定 channel 为 this：sendApprovalCard 是实例方法，裸引用
      // 调用会丢 this，方法体第一行 this.client 即 undefined（生产已踩）。
      const fn = channel.sendApprovalCard
      if (fn === undefined) return false
      try {
        const ok = await fn.call(channel, target, { ...card, reason: card.reason })
         ctx.logger?.info?.(`sendCard result: kind=${kind} ok=${ok}`)
        return ok
      } catch (error) {
         ctx.logger?.info?.(`sendCard threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
        return false
      }
    },
    line => { ctx.logger.info(`[im-channel] ${line}`) },
  )
  // P1.5 任务决策桥（task-board 阻断式审批的按钮卡承接）：卡片走同一渠道
  // 能力（sendApprovalCard 任务变体），点击走同一条 template_card_event 链路；
  // 文本兜底由 task-board 的主人回复拦截器承接（同意/拒绝 TB-x）。
  const taskBridge = new TaskDecisionBridge(
    async (kind, ownerUserId, card) => {
      const channel = channelOf(kind)
      const target = ownerTargetOf(kind, ownerUserId)
      if (channel === undefined || target === undefined || typeof channel.sendApprovalCard !== 'function') return false
      const fn = channel.sendApprovalCard
      try { return await fn.call(channel, target, card) } catch (error) {
        ctx.logger?.warn?.(`[im-channel] 任务决策卡发送失败（${kind}）:`, error instanceof Error ? error.message : String(error))
        return false
      }
    },
    (kind, ownerUserId, body) => {
      const r = router
      if (r === undefined) return Promise.resolve(false)
      return r.pushToUser(kind as 'feishu' | 'wechat' | 'wecom', ownerUserId, body, { markdown: true })
    },
    () => {
      const out: Array<{ kind: string; userId: string }> = []
      for (const kind of ['feishu', 'wechat', 'wecom'] as const) {
        if (router?.channels.find(ch => ch.kind === kind) === undefined) continue
        const owner = store.ownerFor(kind)
        if (owner === undefined || owner.userId === '') continue
        if (store.targetIdFor({ kind, userId: owner.userId as never }) === undefined) continue
        out.push({ kind, userId: owner.userId })
      }
      return out
    },
    line => { try { ctx.logger.info(`[im-channel] ${line}`) } catch { /* ignore */ } },
  )
  // 沿 parentSession 链向上找Owner会话（数字分身模型下访客的会话继承自分身）。
    // 用于审批/提问必须把卡片发到Owner本人，而不是发到触发它的访客。
    const ownerSessionOf = (agentId: string): string => {
      const agents = ctx.get('agents') as { get: (id: string) => { session?: { header: { id: string; parentSession?: string } } } | undefined } | undefined
      if (agents === undefined) return agentId
      let id: string = agentId
      for (let depth = 0; depth < 8; depth++) {
        const agent = agents.get(id)
        if (agent?.session === undefined) return id
        const parent: string | undefined = agent.session.header.parentSession
        if (parent === undefined) return id
        id = parent
      }
      return id
    }
    const ownerRowFor = (sessionId: string): { kind: 'feishu' | 'wechat' | 'wecom'; userId: string } | undefined => {
      const rootId = ownerSessionOf(sessionId)
      const ids: string[] = rootId === sessionId ? [sessionId] : [sessionId, rootId]
      for (const id of ids) {
        const row = store.findBySession(id)
        if (row !== undefined) return row
      }
      return undefined
    }

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
    guestTools: () => section.read().guestTools ?? [],
    agentPreset: () => section.read().agentPreset || undefined,
    memoryAssemblePerTurn: () => section.read().memoryAssemblePerTurn === true,
    // 非本插件驱动轮次的产出（schedule 提醒、yuyi 唤醒、竞态尾巴）
    // 主动推送到该会话绑定用户的 IM——网页端看得到的，手机上也看得到。
    onBackgroundMessage: (sessionId, messageText) => {
      const row = ownerRowFor(sessionId)
      if (row === undefined) return
      const r = router
      if (r === undefined) return
      void r.pushToUser(row.kind, row.userId, messageText, { markdown: true }).then(delivered => {
        if (!delivered) ctx.logger.info(`[im-channel] 后台响应推送失败：${row.kind} ${row.userId.slice(0, 8)}… 无可达目标`)
      })
    },
    onUserQuestion: (sessionId, questions) => {
      const row = ownerRowFor(sessionId)
      if (row === undefined) return Promise.reject(new Error('会话未绑定 IM 用户，无法经 IM 提问'))
      return questionBridge.ask(row.kind, row.userId, questions)
    },
    onOwnerApproval: ({ sessionId, toolName, reason, guestUserId }) => {
      const row = store.findBySession(sessionId)
      if (row === undefined) return Promise.resolve('rejected' as const)
      const owner = store.ownerFor(row.kind)
      if (owner === undefined) return Promise.resolve('rejected' as const)
      // 主人自触发时 label 标「你」+ 工具名（双卡区分）；访客触发时保留「访客：xxx」。
      // ownerUserId 与 trigger userId 一致时即「自触发」。
      const isOwnerTrigger = guestUserId !== undefined && owner.userId === guestUserId
      const label = isOwnerTrigger
        ? `你（${toolName}）`
        : `访客：${(guestUserId === undefined || guestUserId === 'unknown' ? row.userId : guestUserId).slice(0, 16)}`
      return approvalBridge.request(row.kind, owner.userId, label, { toolName, reason })
    },
  })
  // 在插件根 context 挂审批瀑布线（与 agent 建立时机解耦）：保证 Owner 自身的
  // 沙箱 escalate 也能被 IM 桥接——之前在 driver 构造函数里监听会被不在
  // owned 映射的 Owner 自身会话绕过。
  driver.installApprovalHook()
  // One bind store for the whole plugin lifetime (and process-shared with
  // the login HTTP API): the bound-session rows must survive router
  // rebuilds, and /bind hands out new sessions from it.
  const store = BindStore.shared

  // ── P1.5 控制台提问升级（主人拍板）：对话区问题卡（ask_user_question）在
  // 主人不在电脑旁时升级企微（编号选项，回复即答案），答案经
  // userQuestions.answer 回注原会话——会话解除阻塞继续跑。
  // 拦截点：包装 userQuestions.askTimed（实例方法影子，「包装替换」先例），
  // 捕获 (agent, callId, questions) 后委托原实现；仅控制台来源会话升级
  // （driver 自有会话已有 questionBridge 全链路，跳过防双发）。
  // 范围 v1：单问题批次（多问题批次走网页端）。
  /** P1.5 升级链文件级诊断（每个决策点落盘；定位断点用）。 */
  const escDebug = (line: string): void => {
    try {
      const homeDir = process.env.DSH_HOME ?? join(homedir(), '.dsh')
      const file = join(homeDir, 'im-channel', 'escalation-debug.log')
      mkdirSync(dirname(file), { recursive: true })
      appendFileSync(file, `${new Date().toISOString()} ${line}` + '\n', 'utf8')
    } catch { /* 诊断静默 */ }
  }
  const consoleQuestionPending = new Map<string, {
    sessionId: string
    callId: string
    questions: QuestionItem[]
    agentObj: unknown
    ownerUserIds: Array<{ kind: string; userId: string }>
    resolve: (answer: QuestionAnswer) => void
  }>()
  /** P1.5 门控信号 v2（遥测实证：控制台活跃信号有未知自刷新源，弃用）：
   *  engagedElsewhere = 排除提问会话自身后仍有其他 master-facing 会话在被服务
   *  （纯 session/list，dsh-mind 0.10.17+；旧版 mind → undefined=信号缺席）。 */
  const samplePresence = (excludeSessionId?: string): { engagedElsewhere?: boolean } | undefined => {
    try {
      const mind = (ctx as unknown as { get(name: string): unknown }).get('dsh-mind') as { presenceState?: (o?: { excludeSessionId?: string }) => { engagedElsewhere?: boolean } } | undefined
      return mind?.presenceState?.({ ...(excludeSessionId !== undefined ? { excludeSessionId } : {}) })
    } catch { return undefined }
  }
  const consoleMasterTargets = (): Array<{ kind: 'feishu' | 'wechat' | 'wecom'; userId: string }> => {
    const out: Array<{ kind: 'feishu' | 'wechat' | 'wecom'; userId: string }> = []
    for (const kind of ['feishu', 'wechat', 'wecom'] as const) {
      if (router?.channels.find(ch => ch.kind === kind) === undefined) continue
      const owner = store.ownerFor(kind)
      if (owner === undefined || owner.userId === '') continue
      if (store.targetIdFor({ kind, userId: owner.userId as never }) === undefined) continue
      out.push({ kind, userId: owner.userId })
    }
    return out
  }

  // 包装 userQuestions.askTimed（惰性注入：userQuestions 由 api-proxy 启动期提供）
  ctx.inject(['userQuestions'], (uqCtx: Context) => {
    escDebug('inject 回调触发（userQuestions 已解析）')
    const uq = (uqCtx as unknown as { get(name: string): unknown }).get('userQuestions') as {
      ask(request: unknown): Promise<unknown>
      askTimed(request: unknown, callId: string, timeoutMs: number): Promise<unknown>
      answer(agent: unknown, callId: string, answer: unknown): boolean
    } | undefined
    if (uq === undefined || typeof uq.askTimed !== 'function' || typeof uq.answer !== 'function') {
      escDebug('userQuestions 不完整/未提供——升级未启用')
      ctx.logger?.info?.('[im-channel] userQuestions 服务不完整——控制台提问升级未启用')
      return
    }
    const escalateConsoleQuestion = (info: { sessionId: string; callId: string; questions: QuestionItem[]; agentObj: unknown; promise: Promise<unknown> }): void => {
      escDebug(`提问捕获: session=${info.sessionId.slice(0, 10)}… callId=${info.callId} 题数=${info.questions.length}`)
      void (async () => {
        let unknownTries = 0
        for (;;) {
          const settled = await Promise.race([
            info.promise.then(() => true as const),
            new Promise<false>(resolve => setTimeout(() => resolve(false), 60_000)),
          ])
          if (settled) { escDebug(`提问 ${info.callId}: 已在别处回答，升级收尾`); return }
          const ps = samplePresence()
          if (ps?.engagedElsewhere === true) { escDebug(`提问 ${info.callId}: 主人在别处对话中，60s 重查`); continue }
          if (ps?.engagedElsewhere === false) break
          unknownTries += 1
          if (unknownTries >= 3) {
             ctx.logger?.info?.(`提问 ${info.callId}：在场信号不可用，放弃 IM 升级（控制台可答）`)
            return
          }
           ctx.logger?.info?.(`提问 ${info.callId}：在场信号未知（${unknownTries}/3），10 分钟后重判`)
          await new Promise(resolve => setTimeout(resolve, 600_000))
        }
        const targets = consoleMasterTargets()
        escDebug(`提问 ${info.callId}: atComputer=false 触发升级，masterTargets=${targets.length}`)
        if (targets.length === 0) return
        const key = `${info.sessionId}:${info.callId}`
        let resolvePending: (answer: QuestionAnswer) => void = () => {}
        const answerPromise = new Promise<QuestionAnswer>(resolve => { resolvePending = resolve })
        consoleQuestionPending.set(key, {
          sessionId: info.sessionId, callId: info.callId, questions: info.questions, agentObj: info.agentObj,
          ownerUserIds: targets.map(t => ({ kind: t.kind, userId: t.userId })), resolve: resolvePending,
        })
        const card = `${questionText(info.questions)}
（直接回复选项编号或内容即作答；来自会话 ${info.sessionId.slice(0, 8)}…）`
        for (const t of targets) {
          try { void router?.pushToUser(t.kind, t.userId, card, { markdown: true }) } catch { /* 单目标失败不阻断 */ }
        }
        const winner = await Promise.race([
          answerPromise.then(a => ({ source: 'im' as const, answer: a })),
          info.promise.then(() => ({ source: 'web' as const })),
        ])
        consoleQuestionPending.delete(key)
        if (winner.source === 'web') {
          for (const t of targets) {
            try { void router?.pushToUser(t.kind, t.userId, 'ℹ️ 该问题已在控制台处理，企微答案忽略。', { markdown: true }) } catch { /* 静默 */ }
          }
          return
        }
        const ok = uq.answer(info.agentObj, info.callId, winner.answer)
        const feedback = ok ? '✅ 已回答，会话继续运行。' : '❌ 回注失败：会话可能已更替——请在控制台重新提问。'
        for (const t of targets) {
          try { void router?.pushToUser(t.kind, t.userId, feedback, { markdown: true }) } catch { /* 静默 */ }
        }
      })()
    }
    // P1.5 补充：宿主注册的 ask_user_question 工具 timeout=-1（无限等待），
    // 走 ask() 路径而非 askTimed——ask() 的 request 不带 agent 对象，
    // 从 agents.currentInitiator() 取调用链上的发起 Agent。
    const agentsSvc = (ctx as unknown as { get(name: string): unknown }).get('agents') as { currentInitiator?: () => unknown } | undefined
    const originalAsk = uq.ask.bind(uq)
    // P1.5 核心机制（调研定稿）：untimed ask（宿主工具默认 timeout=-1）没有
    // callId，无法被外部回注——正解是「源头升级」：主人不在电脑旁时，包装器
    // 把控制台提问改调 askTimed（10 分钟限时 + 升级器自造 callId），企微答案
    // 经 userQuestions.answer(自造 callId) 回注——宿主设计内的合法路径。
    uq.ask = async (request: unknown): Promise<unknown> => {
      const req = request as { questions?: QuestionItem[]; agent?: unknown; signal?: AbortSignal }
      const agentObj = req?.agent ?? agentsSvc?.currentInitiator?.()
      const sessionId = (agentObj as { session?: { header?: { id?: string } } } | undefined)?.session?.header?.id
      const single = Array.isArray(req?.questions) && req.questions.length === 1
      const driverOwned = sessionId !== undefined && typeof driver?.ownsSession === 'function' && driver.ownsSession(sessionId)
      if (sessionId === undefined) { escDebug('ask 跳过: 无法定位会话（无 agent）'); return originalAsk(request) }
      const elsewhere = samplePresence(sessionId)?.engagedElsewhere === true
      escDebug(`ask 触发: 别处有对话=${elsewhere} 单问题=${single} driverOwned=${driverOwned} 有agent=${agentObj !== undefined}`)
      if (!single || driverOwned || elsewhere || agentObj === undefined) return originalAsk(request)
      const callId = `esc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      escDebug(`ask 源头升级: callId=${callId} 限时 10 分钟`)
      const questions = req.questions as QuestionItem[]
      const targets = consoleMasterTargets()
      if (targets.length === 0) {
        escDebug('masterTargets 为空——回退 untimed ask')
        return originalAsk(request)
      }
      const askTimedPromise = uq.askTimed({ ...req, agent: agentObj }, callId, 10 * 60 * 1000)
      let resolveAnswer: (answer: QuestionAnswer) => void = () => {}
      const answerPromise = new Promise<QuestionAnswer>(resolve => { resolveAnswer = resolve })
      const sessId: string = sessionId
      consoleQuestionPending.set(`${sessId}:${callId}`, {
        sessionId: sessId, callId, questions, agentObj,
        ownerUserIds: targets.map(t => ({ kind: t.kind, userId: t.userId })), resolve: resolveAnswer,
      })
      const card = `${questionText(questions)}
（主人不在电脑旁——直接回复选项编号或内容即作答；来自会话 ${(sessionId ?? '').slice(0, 8)}…）`
      for (const t of targets) {
        try { void router?.pushToUser(t.kind, t.userId, card, { markdown: true }) } catch { /* 单目标失败不阻断 */ }
      }
      const winner = await Promise.race([
        answerPromise.then(a => ({ source: 'im' as const, answer: a })),
        askTimedPromise.then(() => ({ source: 'web-or-timeout' as const })),
      ])
      consoleQuestionPending.delete(`${sessionId}:${callId}`)
      if (winner.source === 'im') {
        const ok = uq.answer(agentObj, callId, winner.answer)
        escDebug(`answer 回注: ok=${ok}`)
        if (!ok) {
          for (const t of targets) { try { void router?.pushToUser(t.kind, t.userId, '❌ 回注失败：会话可能已更替——请在控制台重新提问。', { markdown: true }) } catch { /* 静默 */ } }
        }
        return askTimedPromise
      }
      for (const t of targets) { try { void router?.pushToUser(t.kind, t.userId, 'ℹ️ 该问题已在控制台处理或已超时挂起。', { markdown: true }) } catch { /* 静默 */ } }
      return askTimedPromise
    }
    const originalAskTimed = uq.askTimed.bind(uq)
    uq.askTimed = (request: unknown, callId: string, timeoutMs: number): Promise<unknown> => {
      const promise = originalAskTimed(request, callId, timeoutMs)
      try {
        const req = request as { agent?: { session?: { header?: { id?: string } } }; questions?: QuestionItem[] }
        const sessionId = req?.agent?.session?.header?.id
        const driverOwns = sessionId !== undefined && typeof driver?.ownsSession === 'function' && driver.ownsSession(sessionId)
        if (sessionId !== undefined && driverOwns !== true && Array.isArray(req?.questions) && req.questions.length === 1) {
          escalateConsoleQuestion({ sessionId, callId, questions: req.questions as QuestionItem[], agentObj: req?.agent, promise })
        }
      } catch (e) {
        ctx.logger?.warn?.('[im-channel] 提问升级协程异常（忽略）:', e instanceof Error ? e.message : String(e))
      }
      return promise
    }
    escDebug('askTimed 包装已安装（askTimed/answer 均可用）')
    // 企微回复 → 解析答案 → resolve 待决升级（命令前缀不消费）
    ownerReplyInterceptors.push((kind, ownerUserId, text) => {
      const prefix = section.read().commandPrefix || '/'
      if (text.startsWith(prefix)) return false
      for (const pending of consoleQuestionPending.values()) {
        if (!pending.ownerUserIds.some(t => t.userId === ownerUserId)) continue
        escDebug(`拦截器命中提问答案: owner=${ownerUserId.slice(0, 8)}… text=${text.slice(0, 24)}`)
        const answerItem = answerForQuestion(pending.questions[0], text)
        consoleQuestionPending.delete(`${pending.sessionId}:${pending.callId}`)
        pending.resolve({ answers: [answerItem] })
        return true
      }
      return false
    })
    ctx.logger?.info?.('[im-channel] 控制台提问升级已启用（askTimed 包装 + 在场门控 + 离开沿触发；单问题批次）')
  })

  /** Rebuild the router from the current declared instances: dispose the old one, then build channels for every credentialled enabled instance. */
  const rebuildRouter = (): void => {
    const next = section.read()
    disposeRouter?.()
    disposeRouter = undefined
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
        // 可选身份增强（宪章第三阶段 P3-4）：dsh-actors 在场时顺带注册实体——
        // 主人 bindMaster 锚定（冲突 WARN 不静默）、访客 provision 为生人；
        // 缺席/失败静默跳过，绑定权威仍在 bind-store（宪章 §3.4）。
        onActorsBind: (channel, userId, isMaster) => {
          try {
            const actors = (ctx as unknown as { get(name: string): unknown }).get('dsh-actors') as
              | {
                provision?: (channel: unknown, userId: unknown, display?: unknown) => unknown
                bindMaster?: (channel: unknown, userId: unknown) => { ok?: boolean; error?: string } | undefined
              }
              | undefined
            if (actors === undefined || typeof actors.provision !== 'function') return
            actors.provision(channel, userId)
            if (isMaster && typeof actors.bindMaster === 'function') {
              const r = actors.bindMaster(channel, userId)
              if (r !== undefined && r !== null && r.ok === false) {
                ctx.logger?.warn?.(`[im-channel] dsh-actors 主人锚定冲突：${r.error ?? '未知原因'}（绑定权威仍以 bind-store 为准）`)
              } else {
                ctx.logger?.info?.('[im-channel] dsh-actors 主人实体已锚定')
              }
            }
          } catch (e) {
            ctx.logger?.warn?.('[im-channel] dsh-actors 注册失败（跳过）:', e instanceof Error ? e.message : String(e))
          }
        },
        log: (line: string): void => { ctx.logger.info(line) },
        allowed: (from): boolean => {
          const list = section.read().allowlist
          if (list === undefined || list.length === 0) return true
          return list.includes(from.userId) || list.includes(`${from.kind}:${from.userId}`)
        },
        guestCommands: (): readonly string[] => section.read().guestCommands ?? DEFAULT_GUEST_COMMANDS,
        approval: {
          consumeOwnerReply: (kind, ownerUserId, messageText) => approvalBridge.consumeOwnerReply(kind, ownerUserId, messageText),
          resolveByToken: (kind, token, decision, userId, settleCard) => approvalBridge.resolveByToken(kind, token, decision, userId, settleCard),
        },
        taskApproval: {
          resolveByToken: (kind, token, decision, userId, settleCard) => taskBridge.resolveByToken(kind, token, decision, userId, settleCard),
        },
        ownerReplyInterceptor: {
          consume: (kind: 'feishu' | 'wechat' | 'wecom', ownerUserId: string, messageText: string): boolean => {
            for (const fn of ownerReplyInterceptors) {
              try { if (fn(kind, ownerUserId, messageText) === true) return true } catch (e) { ctx.logger?.warn?.('[im-channel] 回复拦截器异常（按未消费处理）:', e instanceof Error ? e.message : String(e)) }
            }
            return false
          },
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
      // effect 闭包必须捕获当前 router 实例：外层 `let router` 是惰性读取，
      // cordis async effect 的生成器体延迟一个 microtask 才执行——连续两次
      // rebuildRouter 时，第一个 effect 会误启动第二个 router（双重 start →
      // 双重 connect → 僵尸 WSClient，企微单活跃连接下消息推送中断）。
      const owned = router
      void ctx.effect(async function* () {
        await owned.start()
        yield () => { void owned.stop() }
      }, 'im-channel.router')
      disposeRouter = () => { void owned.stop(); router = undefined }
  }

  // 0.1.7 设置契约（docs/migration-0.1.7.md §4-T3）：installSection 已随
  // settings 重写移除（0.1.8 在 0.1.7-rc.2 运行时上调用它 = TypeError，
  // onChange 永不触发 → 路由永不重建 → 通道离线、/bind 无响应）。
  // 新模型：配置权威 = Loader 注入的 apply(config)；条目配置变更由
  // configEditor 应用 → 插件重载 → apply 重入 → 这里全量重建。
  rebuildRouter()
}
