/**
 * Browser-facing login surface: one webServer route pair per boot that starts
 * a QR login for any supported platform and reports its status. The QR
 * image renders in the browser from the URL the platform returns; the host
 * only brokers the credential exchange.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge declared by dsh-host-webserver.
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

type LoginKind = 'wechat' | 'feishu' | 'wecom'
const KINDS: readonly LoginKind[] = ['wechat', 'feishu', 'wecom']

const KIND_LABELS: Record<LoginKind, string> = {
  wechat: '微信',
  feishu: '飞书',
  wecom: '企业微信',
}

const NS = settingsNamespace('im-channel')

/** Session record the platform login bridges write the QR URL onto. */
export interface QrLoginBridge {
  qrUrl: string | undefined
}

interface QrLoginSession extends QrLoginBridge {
  kind: LoginKind
  startedAt: number
  status: 'pending' | 'confirmed' | 'error'
  error: string | undefined
}

const SESSION_TTL_MS = 8 * 60_000

export class LoginApi {
  private session: QrLoginSession | undefined
  /** 企业微信扫码创建会话（scode），start 时建立、status 轮询消费。 */
  private wecomQr: { scode: string; startedAt: number } | undefined

  constructor(private readonly ctx: Context) {}

  /** Register the /im-channel/login/* routes on the web server. */
  register(): void {
    // Narrow local view of the webServer service: the runtime name and the
    // published typings' augmentation have drifted between harness versions
    // (webServer locally, httpServer in older published rc's), so reach
    // through a structural cast that compiles against both.
    const web = (this.ctx as unknown as {
      webServer: { register(route: { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }): void }
    }).webServer
    web.register({
      kind: 'exact',
      path: '/im-channel/login/start',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleStart(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/login/status',
      handler: (_req: IncomingMessage, res: ServerResponse) => this.handleStatus(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/bindings',
      handler: (_req: IncomingMessage, res: ServerResponse) => this.handleBindings(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/bindings/remove',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleBindingRemove(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/wecom/configure',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleWecomConfigure(req, res),
    })
    // 企业微信扫码创建智能机器人（qc 快速创建服务）：扫码即建即得凭证。
    web.register({
      kind: 'exact',
      path: '/im-channel/wecom/qr/start',
      handler: (_req: IncomingMessage, res: ServerResponse) => void this.handleWecomQrStart(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/wecom/qr/status',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleWecomQrStatus(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/wecom/mcp-configure',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleWecomMcpConfigure(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/wecom/mcp-config',
      handler: (_req: IncomingMessage, res: ServerResponse) => void this.handleWecomMcpConfig(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/mcp-servers',
      handler: (_req: IncomingMessage, res: ServerResponse) => void this.handleMcpServersList(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/mcp-servers/add',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleMcpServerAdd(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/mcp-servers/update',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleMcpServerUpdate(req, res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/mcp-servers/remove',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleMcpServerRemove(req, res),
    })
    // 连接测试：向该渠道最近绑定的用户推送测试消息（不建会话、不调模型）。
    web.register({
      kind: 'exact',
      path: '/im-channel/test-send',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleTestSend(req, res),
    })
    // 访客权限（数字分身模型）：Owner 在设置页配置访客可用的工具与命令。
    web.register({
      kind: 'exact',
      path: '/im-channel/guest-permissions',
      handler: (_req: IncomingMessage, res: ServerResponse) => void this.handleGuestPermissions(res),
    })
    web.register({
      kind: 'exact',
      path: '/im-channel/guest-permissions/update',
      handler: (req: IncomingMessage, res: ServerResponse) => void this.handleGuestPermissionsUpdate(req, res),
    })
  }

  /** GET /im-channel/guest-permissions：当前配置 + 工具/命令目录 + Owner 状态。 */
  private handleGuestPermissions(res: ServerResponse): void {
    void (async () => {
      try {
        const { GUEST_TOOL_CATALOG, GUEST_COMMAND_CATALOG, DEFAULT_GUEST_COMMANDS } = await import('../core/guest-permissions.ts')
        const { BindStore } = await import('../core/bind-store.ts')
        const section = await this.readSettingsSection()
        const owners: Record<string, { bound: boolean; userId: string }> = {}
        for (const kind of KINDS) {
          const owner = BindStore.shared.ownerFor(kind as 'feishu' | 'wechat' | 'wecom')
          owners[kind] = owner === undefined
            ? { bound: false, userId: '' }
            : { bound: true, userId: `${owner.userId.slice(0, 8)}…` }
        }
        respondJson(res, 200, {
          ok: true,
          guestTools: section.guestTools ?? [],
          guestCommands: section.guestCommands ?? [...DEFAULT_GUEST_COMMANDS],
          toolCatalog: GUEST_TOOL_CATALOG,
          commandCatalog: GUEST_COMMAND_CATALOG,
          owners,
        })
      } catch (error) {
        respondJson(res, 500, { ok: false, error: messageOf(error) })
      }
    })()
  }

  /** POST /im-channel/guest-permissions/update：保存访客工具/命令白名单。 */
  private async handleGuestPermissionsUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { guestTools?: unknown; guestCommands?: unknown }
      const patch: { guestTools?: string[]; guestCommands?: string[] } = {}
      if (Array.isArray(body.guestTools)) patch.guestTools = body.guestTools.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
      if (Array.isArray(body.guestCommands)) patch.guestCommands = body.guestCommands.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
      if (Object.keys(patch).length === 0) {
        respondJson(res, 400, { ok: false, error: 'guestTools/guestCommands 至少提供一个有效数组' })
        return
      }
      await new Promise<void>((resolve, reject) => {
        this.ctx.inject(['settings'], sctx => {
          void sctx.settings.update(NS, patch).then(resolve, reject)
        })
      })
      respondJson(res, 200, { ok: true })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  /** POST /im-channel/test-send {kind}：向该渠道最近绑定的用户发测试消息。 */
  private async handleTestSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { kind?: string }
      const kind = body.kind
      if (typeof kind !== 'string' || !KINDS.includes(kind as LoginKind)) {
        respondJson(res, 400, { ok: false, error: `kind 必须是 ${KINDS.join('/')}` })
        return
      }
      const push = (this.ctx.get('im-channel') as { pushToUser?: (kind: string, userId: string, text: string, options?: { markdown?: boolean }) => Promise<boolean> } | undefined)?.pushToUser
      if (push === undefined) {
        respondJson(res, 500, { ok: false, error: '推送服务不可用（路由未就绪）' })
        return
      }
      const userId = await this.userIdForFirstBinding(kind)
      if (userId === '') {
        respondJson(res, 404, { ok: false, error: `尚无 ${kind} 绑定用户，无法发送测试消息` })
        return
      }
      const delivered = await push(kind, userId, '✅ DeepSeek Harness 连接测试成功', { markdown: false })
      respondJson(res, 200, { ok: delivered, delivered, error: delivered ? undefined : '发送失败（无可达目标或渠道未连接）' })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  /** The first bound userId of a channel kind (test-send target). */
  private async userIdForFirstBinding(kind: string): Promise<string> {
    const { BindStore } = await import('../core/bind-store.ts')
    const rows = (BindStore.shared as unknown as { rowsForListing(): Array<{ kind: string; userId: string }> }).rowsForListing()
    return rows.find(row => row.kind === kind)?.userId ?? ''
  }

  /** Read the im-channel settings section values this surface reports. */
  private async readSettingsSection(): Promise<{ guestTools?: string[]; guestCommands?: string[] }> {
    return await new Promise(resolve => {
      this.ctx.inject(['settings'], sctx => {
        const section = sctx.settings.get(NS) as { guestTools?: string[]; guestCommands?: string[] } | undefined
        resolve(section ?? {})
      })
    })
  }

  private async handleBindingRemove(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { kind?: string; userId?: string; sessionId?: string }
      const { removeBinding } = await import('../core/bind-store.ts')
      const match: { kind?: string; userId?: string; sessionId?: string } = {}
      if (typeof body.kind === 'string') match.kind = body.kind
      if (typeof body.userId === 'string') match.userId = body.userId
      if (typeof body.sessionId === 'string') match.sessionId = body.sessionId
      const removed = removeBinding(match)
      respondJson(res, 200, { ok: true, removed })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleWecomConfigure(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { botId?: string; secret?: string }
      if (typeof body.botId !== 'string' || typeof body.secret !== 'string') {
        respondJson(res, 400, { ok: false, error: '需要 BotID 和 Secret' })
        return
      }
      const { configureWecomBot } = await import('../channels/wecom/login-bridge.ts')
      await configureWecomBot(body.botId, body.secret)
      // 自动创建通道实例
      await this.ensureChannelInstance('wecom')
      // 触发重连，让新凭证立即生效
      try {
        const { WecomChannel } = await import('../channels/wecom/index.ts')
        await WecomChannel.activeInstance?.reconnect()
      } catch (e) {
        // 重连失败不影响凭证保存
        this.ctx.logger.warn(`im-channel: 企业微信重连失败: ${messageOf(e)}`)
      }
      // 如果当前有登录会话，标记为已确认
      if (this.session !== undefined && this.session.kind === 'wecom') {
        this.session.status = 'confirmed'
      }
      respondJson(res, 200, { ok: true })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  /** GET /im-channel/wecom/qr/start：生成扫码创建机器人的二维码。 */
  private handleWecomQrStart(res: ServerResponse): void {
    void (async () => {
      try {
        const { WecomQrAuth } = await import('../channels/wecom/qr-auth.ts')
        const start = await new WecomQrAuth().start()
        this.wecomQr = { scode: start.scode, startedAt: Date.now() }
        respondJson(res, 200, { ok: true, qrUrl: start.verificationUrl, scode: start.scode, expiresAt: start.expiresAt, pollIntervalMs: start.pollIntervalMs })
      } catch (error) {
        respondJson(res, 500, { ok: false, error: messageOf(error) })
      }
    })()
  }

  /** GET /im-channel/wecom/qr/status?scode=…：轮询扫码状态；成功即保存凭证并连接。 */
  private handleWecomQrStatus(req: IncomingMessage, res: ServerResponse): void {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const scode = url.searchParams.get('scode') ?? this.wecomQr?.scode ?? ''
        if (scode === '' || (this.wecomQr !== undefined && this.wecomQr.scode !== scode)) {
          respondJson(res, 400, { ok: false, error: '无效的扫码会话' })
          return
        }
        const { WecomQrAuth } = await import('../channels/wecom/qr-auth.ts')
        const poll = await new WecomQrAuth().poll(scode)
        if (poll.status === 'success') {
          const { configureWecomBot } = await import('../channels/wecom/login-bridge.ts')
          await configureWecomBot(poll.botId, poll.secret)
          await this.ensureChannelInstance('wecom')
          try {
            const { WecomChannel } = await import('../channels/wecom/index.ts')
            await WecomChannel.activeInstance?.reconnect()
          } catch {
            // 重连失败不影响凭证保存；重启后自然生效。
          }
          this.wecomQr = undefined
          respondJson(res, 200, { ok: true, status: 'confirmed' })
          return
        }
        respondJson(res, 200, { ok: true, status: poll.status })
      } catch (error) {
        respondJson(res, 500, { ok: false, error: messageOf(error) })
      }
    })()
  }

  private async handleWecomMcpConfigure(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { mcpServers?: Record<string, { type: string; url: string }> }
      if (!body.mcpServers) {
        respondJson(res, 400, { ok: false, error: '需要 MCP 服务器配置' })
        return
      }
      const { saveWecomMcpConfigEx } = await import('../channels/wecom/login-bridge.ts')
      await saveWecomMcpConfigEx(body.mcpServers)
      respondJson(res, 200, { ok: true })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleWecomMcpConfig(res: ServerResponse): Promise<void> {
    try {
      const { loadWecomMcpConfig } = await import('../channels/wecom/index.ts')
      const config = loadWecomMcpConfig()
      respondJson(res, 200, { ok: true, config: config ?? null })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleMcpServersList(res: ServerResponse): Promise<void> {
    try {
      const { loadMcpServers } = await import('../channels/mcp-server-manager.ts')
      const servers = loadMcpServers()
      respondJson(res, 200, { ok: true, servers })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleMcpServerAdd(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { name?: string; type?: string; url?: string }
      if (typeof body.name !== 'string' || typeof body.url !== 'string') {
        respondJson(res, 400, { ok: false, error: '需要 name 和 url' })
        return
      }
      const { addMcpServer } = await import('../channels/mcp-server-manager.ts')
      const entry = addMcpServer({
        name: body.name,
        type: body.type ?? 'streamable-http',
        url: body.url,
        enabled: true,
      })
      respondJson(res, 200, { ok: true, server: entry })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleMcpServerUpdate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { id?: string; name?: string; type?: string; url?: string; enabled?: boolean }
      if (typeof body.id !== 'string') {
        respondJson(res, 400, { ok: false, error: '需要 id' })
        return
      }
      const { updateMcpServer } = await import('../channels/mcp-server-manager.ts')
      const updated = updateMcpServer(body.id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.url !== undefined ? { url: body.url } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      })
      respondJson(res, 200, { ok: updated })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async handleMcpServerRemove(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { id?: string }
      if (typeof body.id !== 'string') {
        respondJson(res, 400, { ok: false, error: '需要 id' })
        return
      }
      const { removeMcpServer } = await import('../channels/mcp-server-manager.ts')
      const removed = removeMcpServer(body.id)
      respondJson(res, 200, { ok: removed })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  /**
   * Auto-create a channel instance in settings once a platform login is
   * confirmed so the router (re)starts without manual configuration. One
   * instance per platform: the wechat protocol allows exactly one poll
   * session per bot token, and duplicate instances multiply every reply.
   */
  private async ensureChannelInstance(kind: LoginKind): Promise<void> {
    try {
      this.ctx.inject(['settings'], async sctx => {
        const section = sctx.settings.get(NS) as { channels?: Record<string, { kind: LoginKind }> } | undefined
        const channels = section?.channels ?? {}
        const exists = Object.values(channels).some(v => v.kind === kind)
        if (exists) return
        await sctx.settings.update(NS, {
          channels: {
            [`${kind}-1`]: { kind, enabled: true, displayName: `${KIND_LABELS[kind]}机器人 1` },
          },
        })
      })
    } catch (error) {
      this.ctx.logger.warn(`im-channel: 自动创建 ${kind} 实例失败: ${messageOf(error)}`)
    }
  }

  private handleBindings(res: ServerResponse): void {
    // Read the persisted binding rows directly; each /bind adds one
    // user-to-session row per platform bot.
    void this.readBindings().then(rows => {
      respondJson(res, 200, {
        ok: true,
        bindings: rows,
        count: rows.length,
      })
    })
  }

  private async readBindings(): Promise<Array<{ kind: string; boundAt: string; sessionId: string }>> {
    try {
      const { listBindings } = await import('../core/bind-store.ts')
      return listBindings()
    } catch {
      return []
    }
  }

  private async handleStart(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readJsonBody(req) as { kind?: string }
      const kind = body.kind
      if (typeof kind !== 'string' || !KINDS.includes(kind as LoginKind)) {
        respondJson(res, 400, { ok: false, error: `kind must be one of ${KINDS.join(', ')}` })
        return
      }
      const loginKind: LoginKind = kind as LoginKind
      // A new card click is explicit intent to switch: retire any prior
      // pending session instead of rejecting the new login.
      const prior = this.session
      if (prior !== undefined && prior.status === 'pending') {
        prior.status = 'error'
        prior.error = 'superseded by a new login'
      }
      const session: QrLoginSession = { kind: loginKind, startedAt: Date.now(), qrUrl: undefined, status: 'pending', error: undefined }
      this.session = session
      // Start the platform login out-of-band; the QR URL and terminal state
      // land on the session record for status polling.
      void this.runLogin(loginKind, session)
      // Hold the start response briefly until the platform returns the QR
      // URL so the client can paint it immediately instead of waiting for
      // its first status poll.
      for (let waited = 0; waited < 100 && session.qrUrl === undefined && session.status === 'pending'; waited++) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      // Some platform bridges poll forever without timing out; cap the
      // session so the UI stops waiting after the TTL.
      setTimeout(() => {
        if (this.session === session && session.status === 'pending') {
          session.status = 'error'
          session.error = 'login timed out'
        }
      }, SESSION_TTL_MS).unref()
      // The QR URL arrives asynchronously from the platform; poll status.
      respondJson(res, 200, { ok: true, qrUrl: session.qrUrl })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
  }

  private async runLogin(kind: LoginKind, session: QrLoginSession): Promise<void> {
    try {
      switch (kind) {
        case 'wechat': {
          const { beginWechatQrLogin } = await import('../channels/wechat/login-bridge.ts')
          await beginWechatQrLogin(session)
          break
        }
        case 'feishu': {
          const { beginFeishuQrLogin } = await import('../channels/feishu/login-bridge.ts')
          await beginFeishuQrLogin(session)
          break
        }
        case 'wecom': {
          const { beginWecomLogin } = await import('../channels/wecom/login-bridge.ts')
          await beginWecomLogin(session)
          // 企业微信不需要扫码，保持 pending 状态，等待用户提交表单
          return
        }
      }
      session.status = 'confirmed'
      await this.ensureChannelInstance(kind)
    } catch (error) {
      session.status = 'error'
      session.error = messageOf(error)
    }
  }

  private handleStatus(res: ServerResponse): void {
    const session = this.session
    if (session === undefined || Date.now() - session.startedAt > SESSION_TTL_MS) {
      respondJson(res, 200, { ok: true, session: null })
      return
    }
    respondJson(res, 200, {
      ok: true,
      session: {
        kind: session.kind,
        status: session.status,
        qrUrl: session.qrUrl,
        error: session.error,
        elapsedMs: Date.now() - session.startedAt,
      },
    })
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data.length === 0 ? {} : JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function respondJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
