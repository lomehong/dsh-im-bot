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
      // 如果当前有登录会话，标记为已确认
      if (this.session !== undefined && this.session.kind === 'wecom') {
        this.session.status = 'confirmed'
      }
      respondJson(res, 200, { ok: true })
    } catch (error) {
      respondJson(res, 500, { ok: false, error: messageOf(error) })
    }
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
