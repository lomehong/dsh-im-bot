/**
 * 企业微信智能机器人通道（WeCom AI Bot），基于 @wecom/aibot-node-sdk 的 WebSocket 长连接。
 *
 * 与企业微信管理后台的 BotID + Secret 配对使用：
 *   管理后台 → 应用 → 智能机器人 → API 接收事件 → 长连接
 *
 * 消息流：SDK WebSocket 回调 → 标准化为 InboundMessage → 路由到 DSH agent
 * 回复流：agent 回复 → replyStream 流式推送（打字机效果）
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { WSClient, DefaultLogger } from '@wecom/aibot-node-sdk'
import type { WsFrame, WSClientEventMap, BaseMessage, EventMessage, TextMessage } from '@wecom/aibot-node-sdk'
import type { ImImage, ApprovalAction, ApprovalCardRequest, ImChannel, ImUserId, InboundMessage, InboundUserInfo, OutboundMessage, ReplyTarget, TurnMode, TurnSink } from '../../core/channel.ts'
import { sniffImageMediaType } from '../../core/channel.ts'

/** 通道凭证持久化路径：~/.dsh/im-channel/credentials/wecom.json */
export interface WecomCredentials {
  botId: string
  secret: string
}

function credentialsPath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'credentials', 'wecom.json')
}

export function loadWecomCredentials(): WecomCredentials | undefined {
  const path = credentialsPath()
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as WecomCredentials
}

export function saveWecomCredentials(credentials: WecomCredentials): void {
  const path = credentialsPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}

/** MCP 配置持久化路径：~/.dsh/im-channel/credentials/wecom-mcp.json */
export interface WecomMcpConfig {
  mcpServers: Record<string, { type: string; url: string }>
}

function mcpConfigPath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'credentials', 'wecom-mcp.json')
}

export function loadWecomMcpConfig(): WecomMcpConfig | undefined {
  const path = mcpConfigPath()
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as WecomMcpConfig
}

export function saveWecomMcpConfig(config: WecomMcpConfig): void {
  const path = mcpConfigPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}

export interface WecomChannelOptions {
  /** 诊断日志接收器 */
  log?: (line: string) => void
}

/**
 * 提取文本消息内容
 */
function textFromMessage(body: BaseMessage): string {
  if (body.msgtype === 'text') {
    return (body as TextMessage).text?.content ?? ''
  }
  // 语音消息自动转文字
  if (body.msgtype === 'voice') {
    return (body as any).voice?.content ?? ''
  }
  return ''
}

/**
 * 从消息体构造 ReplyTarget 的 targetId：
 * - 单聊：userid
 * - 群聊：chatid
 */
function targetIdFromMessage(body: BaseMessage): string {
  return body.chattype === 'group' && body.chatid ? body.chatid : body.from.userid
}

export class WecomChannel implements ImChannel {
  readonly kind = 'wecom' as const
  readonly label = '企业微信'

  /** 当前活跃实例，供 LoginApi 更改凭证后触发重连 */
  static activeInstance: WecomChannel | undefined

  private handler: ((message: InboundMessage) => void) | undefined
  private client: WSClient | undefined
  /** 最近收到的消息帧，按 reqId 索引，用于 replyStream 回传 */
  private readonly recentFrames = new Map<string, WsFrame<BaseMessage>>()
  /** 每个用户/群最近一条消息的 reqId，按 targetId 索引 */
  private readonly latestReqId = new Map<string, string>()
  /** 最近收到的消息 ID 去重 */
  private readonly seenMessageIds = new Set<string>()
  private static readonly SEEN_LIMIT = 500
  /** 死通道监听器 */
  private deadHandlers: Array<(reason: string) => void> = []
  /** 审批卡片按钮决策回调（template_card_event → 桥接层）。 */
  private approvalHandlers: Array<(action: ApprovalAction) => void> = []
  /** 用于区分 SDK 端事件与我们的定时器 */
  private cleanTimer: NodeJS.Timeout | undefined

  constructor(private readonly options: WecomChannelOptions = {}) {}

  private log(line: string): void {
    this.options.log?.(line)
  }

  isConfigured(): boolean {
    return loadWecomCredentials() !== undefined
  }

  async connect(): Promise<void> {
    const credentials = loadWecomCredentials()
    if (credentials === undefined) {
      throw new Error('企业微信通道未配置：请先在企业微信管理后台获取 BotID 和 Secret 并保存')
    }

    // 定时清理过期的 seenMessageIds 和 recentFrames
    this.cleanTimer = setInterval(() => { this.pruneStale() }, 60_000)
    this.cleanTimer.unref?.()

    this.client = new WSClient({
      botId: credentials.botId,
      secret: credentials.secret,
      heartbeatInterval: 30_000,
      maxReconnectAttempts: -1, // 无限重连
      maxAuthFailureAttempts: 5,
      logger: new DefaultLogger('[wecom]'),
    })

    // 连接状态事件
    this.client.on('connected', () => {
      this.log('wecom WebSocket 连接已建立')
    })

    this.client.on('authenticated', () => {
      this.log('wecom 认证成功')
    })

    this.client.on('disconnected', (reason: string) => {
      this.log(`wecom 连接断开: ${reason}`)
    })

    this.client.on('reconnecting', (attempt: number) => {
      this.log(`wecom 正在重连 (第 ${attempt} 次)`)
    })

    this.client.on('error', (err: Error) => {
      this.log(`wecom 错误: ${err.message}`)
    })

    // 注册消息事件
    this.client.on('message.text', (data: WsFrame<TextMessage>) => {
      void this.handleIncoming(data)
    })
    // 注册所有消息类型（非文本也只记录帧，用于后续可能的媒体处理）
    // 语音消息在此处理（SDK 自动转文字）
    this.client.on('message.voice', (data: WsFrame<any>) => {
      void this.handleIncoming(data)
    })

    // 注册事件：enter_chat 仅用于记录
    this.client.on('event.enter_chat', (data: WsFrame<EventMessage>) => {
      this.log(`wecom enter_chat: user=${data.body?.from?.userid ?? '?'} chatid=${data.body?.chatid ?? '-'}`)
      // 存储帧以便后续可能的欢迎语回复
      if (data.body) {
        this.recentFrames.set(data.headers.req_id, data as WsFrame<BaseMessage>)
      }
    })

    this.client.on('event.template_card_event', (data: WsFrame<EventMessage>) => {
      const event = data.body?.event
      const eventKey = event && 'event_key' in event ? (event as any).event_key : '-'
      this.log(`wecom template_card_event: user=${data.body?.from?.userid ?? '?'} key=${eventKey}`)
      // 审批按钮回调：key 形如 approve:<token> / deny:<token>（同连接回传）。
      if (typeof eventKey === 'string' && data.body?.from?.userid !== undefined) {
        const match = /^(approve|deny):([a-z0-9]{4,12})$/.exec(eventKey)
        if (match !== null) {
          const client = this.client
          const frameHeaders = data.headers
          const settleCard = async (outcome: 'allowed' | 'rejected' | 'timeout'): Promise<void> => {
            if (client === null || client === undefined) return
            try {
              await client.updateTemplateCard(frameHeaders as never, decidedWecomCard(outcome))
            } catch {
              // 卡片刷新失败不影响决策本身。
            }
          }
          for (const handler of this.approvalHandlers) {
            handler({
              kind: 'wecom',
              token: match[2],
              decision: match[1] === 'approve' ? 'allow' : 'deny',
              userId: data.body.from.userid,
              settleCard,
            })
          }
        }
      }
    })

    this.client.on('event.feedback_event', (data: WsFrame<EventMessage>) => {
      this.log(`wecom feedback_event: user=${data.body?.from?.userid ?? '?'}`)
    })

    this.client.connect()
    WecomChannel.activeInstance = this
  }

  /** 使用最新凭证重新连接（凭证文件已更新后调用） */
  async reconnect(): Promise<void> {
    this.log('wecom 凭证已更新，正在重新连接...')
    // 断开旧连接（如果有）
    this.client?.disconnect()
    this.client = undefined
    // 清理状态
    this.recentFrames.clear()
    this.latestReqId.clear()
    this.seenMessageIds.clear()
    // 重新连接（connect() 会从文件读取最新凭证）
    await this.connect()
  }

  /** 下载企微图片（URL 5 分钟有效；长连接模式返回 AES 加密数据需解密）。 */
  private async dispatchImage(body: { msgid: string; from: { userid: string }; chatid?: string; chattype?: string }, url: string, aeskey: string | undefined): Promise<void> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      let buffer: Buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength > 6 * 1024 * 1024) throw new Error('图片超过大小限制')
      if (aeskey !== undefined && aeskey.length > 0) {
        const { decryptFile } = await import('@wecom/aibot-node-sdk')
        buffer = decryptFile(buffer, aeskey)
      }
      const bytes = new Uint8Array(buffer)
      const mediaType = sniffImageMediaType(bytes)
      if (mediaType === undefined) throw new Error('无法识别图片格式')
      this.handler?.({
        from: { kind: 'wecom', userId: body.from.userid as ImUserId },
        text: '',
        messageId: body.msgid,
        ...(body.chatid !== undefined ? { chatId: body.chatid } : {}),
        ...(body.chattype === 'group' ? { mentioned: true } : {}),
        images: [{ bytes, mediaType }],
      })
    } catch (error) {
      this.log(`wecom 图片消息处理失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  onMessage(handler: (message: InboundMessage) => void): void {
    this.handler = handler
  }

  onDead(handler: (reason: string) => void): void {
    this.deadHandlers.push(handler)
  }

  private reportDead(reason: string): void {
    for (const handler of this.deadHandlers) handler(reason)
  }

  /**
   * 处理收到的消息帧
   */
  private async handleIncoming(data: WsFrame<BaseMessage>): Promise<void> {
    const body = data.body
    if (!body?.msgid) return

    // 消息去重
    if (this.seenMessageIds.has(body.msgid)) return
    this.seenMessageIds.add(body.msgid)
    if (this.seenMessageIds.size > WecomChannel.SEEN_LIMIT) {
      const first = this.seenMessageIds.values().next().value
      if (first !== undefined) this.seenMessageIds.delete(first)
    }

    // 存储帧，用于后续 replyStream 回传 req_id
    this.recentFrames.set(data.headers.req_id, data)

    // 记录每个用户/群最新的 reqId
    const targetId = targetIdFromMessage(body)
    this.latestReqId.set(targetId, data.headers.req_id)

    const text = textFromMessage(body)
    // 图片消息：异步下载（必要时 AES 解密）后作为带图消息路由。
    if (body.msgtype === 'image') {
      const imageBody = body as unknown as { image?: { url?: string; aeskey?: string } }
      const imageUrl = imageBody.image?.url
      if (typeof imageUrl === 'string' && imageUrl.length > 0) {
        void this.dispatchImage(body, imageUrl, imageBody.image?.aeskey)
      }
      return
    }
    // 只处理文本消息（含语音转文字），跳过其他类型
    if (text.length === 0) return

    const userId = body.from.userid
    const chatId = body.chatid
    const isGroup = body.chattype === 'group'

    this.log(`wecom inbound: user=${userId} type=${body.msgtype} chattype=${body.chattype} text=${text.slice(0, 40)}`)

    // 从消息体中提取用户信息
    // SDK 的 BaseMessage 类型只有 from.userid，但实际消息体可能包含更多字段
    // 使用 any 访问未在类型中定义的字段
    const rawBody = body as any
    const userInfo: InboundUserInfo | undefined = rawBody.from?.name || rawBody.sender?.name
      ? {
          userId,
          name: rawBody.from?.name ?? rawBody.sender?.name,
          position: rawBody.from?.position ?? rawBody.sender?.position,
          department: rawBody.from?.department ?? rawBody.sender?.department,
        }
      : undefined

    this.handler?.({
      from: { kind: 'wecom', userId: userId as ImUserId },
      text,
      messageId: body.msgid,
      ...(chatId ? { chatId } : {}),
      ...(isGroup ? { mentioned: true } : {}),
      ...(userInfo ? { userInfo } : {}),
    })
  }

  /**
   * 发送回复：通过主动推送通道发送 Markdown 消息
   */
  /** 发送 button_interaction 模板卡片（允许/拒绝），事件经同连接回传。 */
  async sendApprovalCard(target: ReplyTarget, card: ApprovalCardRequest): Promise<boolean> {
    const client = this.client
    if (client === null || client === undefined) return false
    try {
      await client.sendMessage(target.targetId, {
        msgtype: 'template_card',
        template_card: {
          card_type: 'button_interaction',
          main_title: { title: '访客工具审批', desc: `工具：${card.toolName}` },
          sub_title_text: `访客：${card.guestLabel}${card.reason !== undefined && card.reason.length > 0 ? `
说明：${card.reason.slice(0, 120)}` : ''}
请选择允许或拒绝（超时自动拒绝）`,
          button_list: [
            { text: '允许', key: `approve:${card.token}`, style: 1 },
            { text: '拒绝', key: `deny:${card.token}`, style: 2 },
          ],
        } as never,
      })
      return true
    } catch (error) {
      this.log(`wecom 审批卡片发送失败，回退文本审批: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  onApprovalAction(handler: (action: ApprovalAction) => void): void {
    this.approvalHandlers.push(handler)
  }

  async send(target: ReplyTarget, message: OutboundMessage): Promise<void> {
    const client = this.client
    if (client === undefined) throw new Error('企业微信通道未连接')
    try {
      // 对于文本回复，使用 markdown 格式发送以支持富文本
      await client.sendMessage(target.targetId, {
        msgtype: 'markdown',
        markdown: { content: message.text },
      })
      this.log(`wecom send ok to=${target.targetId.slice(0, 12)}… ${message.text.length} chars`)
    } catch (error) {
      this.log(`wecom send FAILED to=${target.targetId.slice(0, 12)}…: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 打开流式回合：使用 replyStream 实现打字机效果
   * 企业微信支持流式回复（stream reply），通过多次调用 replyStream 实现
   */
  async openTurn(target: ReplyTarget, options: { mode: TurnMode }): Promise<TurnSink> {
    const client = this.client
    if (client === undefined) throw new Error('企业微信通道未连接')
    // 查找该用户最新的 reqId，用于 replyStream
    const reqId = this.latestReqId.get(target.targetId)
    if (reqId === undefined) {
      this.log(`wecom openTurn: 未找到 ${target.targetId.slice(0, 12)}… 的 reqId，降级为非流式`)
      // 降级：使用 sendMessage 方式
      return new WecomTurnSink(client, target, undefined, options.mode, line => this.log(line))
    }
    const streamId = `dsh-${randomBytes(8).toString('hex')}`
    this.log(`wecom openTurn: target=${target.targetId.slice(0, 12)}… reqId=${reqId.slice(0, 12)}… streamId=${streamId}`)
    return new WecomTurnSink(client, target, { reqId, streamId }, options.mode, line => this.log(line))
  }

  async stop(): Promise<void> {
    if (this.client !== undefined) {
      this.client.disconnect()
      this.client = undefined
    }
    if (this.cleanTimer !== undefined) {
      clearInterval(this.cleanTimer)
      this.cleanTimer = undefined
    }
  }

  /** 清理过期缓存的帧和消息 ID */
  private pruneStale(): void {
    // 清理 recentFrames：保留最近 100 条
    if (this.recentFrames.size > 100) {
      const keys = [...this.recentFrames.keys()]
      const toDelete = keys.slice(0, keys.length - 100)
      for (const key of toDelete) this.recentFrames.delete(key)
    }
  }
}

/** 流式回复最小间隔（企业微信无严格限制，但避免过于频繁） */
const WECOM_FLUSH_MS = 500

/**
 * 流式回合：使用 replyStream 实现打字机效果
 * 企业微信智能机器人 SDK 原生支持流式回复（stream reply），
 * 通过多次调用 replyStream(finish=false) 推送中间内容，
 * 最后调用 replyStream(finish=true) 结束。
 *
 * 当 streamInfo 为 undefined 时降级为 sendMessage 增量推送。
 */
class WecomTurnSink implements TurnSink {
  private view = ''
  private lastSent = ''
  private timer: NodeJS.Timeout | undefined
  private finished = false
  private sending = false

  constructor(
    private readonly client: WSClient,
    private readonly target: ReplyTarget,
    /** 流式回复所需的信息（reqId + streamId），undefined 时降级为非流式 */
    private readonly streamInfo: { reqId: string; streamId: string } | undefined,
    private readonly mode: TurnMode,
    private readonly log: (line: string) => void,
  ) {}

  update(view: string): void {
    if (this.finished) return
    this.view = view
    // 安静模式下不推送中间过程
    if (this.mode === 'quiet') return
    if (this.timer === undefined) {
      this.timer = setTimeout(() => { void this.flush() }, WECOM_FLUSH_MS)
      this.timer.unref?.()
    }
  }

  async finish(final: { text: string; markdown?: boolean }): Promise<void> {
    if (this.finished) return
    this.finished = true
    this.stopTimer()
    try {
      if (this.streamInfo !== undefined) {
        // 流式模式：直接发送最终内容并结束流（finish=true 时带上最终内容）
        const frame = { headers: { req_id: this.streamInfo.reqId } }
        await this.client.replyStream(frame, this.streamInfo.streamId, final.text, true)
        this.log(`wecom 流式回复完成: ${final.text.length} chars`)
      } else {
        // 非流式降级：只发送未推送过的增量，避免与流式期间已发的批次重复
        const delta = final.text.startsWith(this.lastSent) ? final.text.slice(this.lastSent.length) : final.text
        if (delta.trim().length > 0) {
          await this.client.sendMessage(this.target.targetId, {
            msgtype: 'markdown',
            markdown: { content: delta },
          })
        }
        this.log(`wecom 非流式回复完成: ${final.text.length} chars (delta ${delta.length})`)
      }
      this.lastSent = final.text
    } catch (error) {
      this.log(`wecom 终稿下发失败: ${error instanceof Error ? error.message : String(error)}`)
      // 失败时兜底：使用 sendMessage
      try {
        await this.client.sendMessage(this.target.targetId, {
          msgtype: 'markdown',
          markdown: { content: final.text },
        })
      } catch (e2) {
        this.log(`wecom 终稿兜底也失败: ${e2 instanceof Error ? e2.message : String(e2)}`)
      }
    }
  }

  async fail(message: string): Promise<void> {
    if (this.finished) return
    this.finished = true
    this.stopTimer()
    try {
      if (this.streamInfo !== undefined) {
        const frame = { headers: { req_id: this.streamInfo.reqId } }
        await this.client.replyStream(frame, this.streamInfo.streamId, message, true)
      } else {
        await this.client.sendMessage(this.target.targetId, {
          msgtype: 'markdown',
          markdown: { content: message },
        })
      }
    } catch (error) {
      this.log(`wecom 失败提示下发失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }

  /**
   * 定时推送增量内容
   * 流式模式下使用 replyStream(finish=false) 推送中间内容
   * 非流式模式下使用 sendMessage 追加消息
   */
  private async flush(): Promise<void> {
    this.timer = undefined
    if (this.finished || this.sending) return
    const view = this.view
    const delta = view.startsWith(this.lastSent) ? view.slice(this.lastSent.length) : view
    if (delta.trim().length === 0) {
      this.lastSent = view
      return
    }
    this.sending = true
    try {
      if (this.streamInfo !== undefined) {
        // 流式模式：推送中间内容（不结束）
        const frame = { headers: { req_id: this.streamInfo.reqId } }
        await this.client.replyStream(frame, this.streamInfo.streamId, view, false)
        this.log(`wecom stream push: ${delta.length} delta chars`)
      } else {
        // 非流式降级：通过 sendMessage 追加增量
        await this.client.sendMessage(this.target.targetId, {
          msgtype: 'markdown',
          markdown: { content: delta },
        })
      }
      this.lastSent = view
    } catch (error) {
      this.log(`wecom 流式推送失败（终稿仍会下发）: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.sending = false
      if (!this.finished) {
        this.timer = setTimeout(() => { void this.flush() }, WECOM_FLUSH_MS)
        this.timer.unref?.()
      }
    }
  }
}

/** 审批卡片定稿态（WeCom template_card 更新体）。 */
function decidedWecomCard(outcome: 'allowed' | 'rejected' | 'timeout'): never {
  const title = outcome === 'allowed' ? '已允许（本次）' : outcome === 'rejected' ? '已拒绝' : '审批超时，自动拒绝'
  return {
    card_type: 'button_interaction',
    main_title: { title: `🔐 访客工具审批 · ${title}` },
    sub_title_text: '本审批已结束',
  } as never
}
