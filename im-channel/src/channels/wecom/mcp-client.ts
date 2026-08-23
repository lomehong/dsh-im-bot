/**
 * MCP 客户端（官方 SDK 实现）
 *
 * 基于 @modelcontextprotocol/sdk，支持两种标准传输：
 *   - Streamable HTTP：initialize / initialized 握手、协议版本协商、
 *     Mcp-Session-Id 会话、Accept: application/json, text/event-stream 双响应形态
 *   - stdio：派生本地服务器进程，经标准输入/输出交换 JSON-RPC
 *
 * 两种传输共用：tools/list cursor 分页、tools/call 超时与中止、
 * isError / structuredContent 透传。
 *
 * 连接为惰性建立：首次 listTools / callTool 时才握手（或派生进程）；
 * 请求失败后自动重置连接，下次调用重新建立（轻量重连）。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { CallToolResultSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** MCP 工具定义 */
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** MCP 服务器配置：url 与 command 二选一，分别对应 HTTP / stdio 传输 */
export interface McpServerConfig {
  name: string
  /** Streamable HTTP 服务器地址 */
  url?: string
  /** stdio 启动命令 */
  command?: string
  /** stdio 启动参数 */
  args?: string[]
  /** stdio 环境变量（叠加在默认环境之上） */
  env?: Record<string, string>
  /** 附加请求头（仅 HTTP，如鉴权 token） */
  headers?: Record<string, string>
  /** 单次请求超时（毫秒），缺省 60 秒 */
  timeoutMs?: number
}

/** 工具调用结果 */
export interface McpCallResult {
  /** 工具自身报错（协议级 isError 标志） */
  isError: boolean
  /** 合并后的文本内容 */
  text: string
  /** 服务器返回的 structuredContent（若有） */
  structuredContent?: unknown
}

/** 运行时默认超时：与官方 dsh-mcp-client 保持一致 */
const DEFAULT_TIMEOUT_MS = 60_000
/** 工具列表缓存时长 */
const CACHE_TTL_MS = 60_000
const CLIENT_INFO = { name: 'dsh-im-channel', version: '0.1.0' }

/** 提取文本内容；非文本内容（图片/音频/资源）降级为占位文本 */
type ContentItem = NonNullable<CallToolResult['content']>[number]
function extractText(content: readonly ContentItem[] | undefined): string {
  const parts: string[] = []
  for (const item of content ?? []) {
    if (item.type === 'text') {
      parts.push(item.text)
    } else if (item.type === 'resource') {
      parts.push(`[资源: ${item.resource.uri}]`)
    } else {
      // image / audio / resource_link 等：保留语义占位，不丢内容线索
      parts.push(`[${item.type} 内容: 暂不支持，已忽略]`)
    }
  }
  return parts.join('\n')
}

/** MCP 客户端（HTTP / stdio 双传输） */
export class McpClient {
  private readonly serverName: string
  private readonly url: string | undefined
  private readonly command: string | undefined
  private readonly args: string[] | undefined
  private readonly env: Record<string, string> | undefined
  private readonly headers: Record<string, string> | undefined
  private readonly timeoutMs: number
  private client: Client | undefined
  private connecting: Promise<Client> | undefined
  private toolsCache: McpTool[] | undefined
  private cacheExpiresAt = 0

  constructor(config: McpServerConfig) {
    const hasUrl = typeof config.url === 'string' && config.url !== ''
    const hasCommand = typeof config.command === 'string' && config.command.trim() !== ''
    if (!hasUrl && !hasCommand) {
      throw new Error(`MCP 服务器「${config.name}」配置不完整：需要 url（HTTP）或 command（stdio）`)
    }
    this.serverName = config.name
    this.url = hasUrl ? config.url : undefined
    this.command = hasCommand ? (config.command as string).trim() : undefined
    this.args = config.args
    this.env = config.env
    this.headers = config.headers
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  get name(): string {
    return this.serverName
  }

  /** 连接指纹：任一连接参数变化即需要换连接 */
  get fingerprint(): string {
    if (this.command !== undefined) {
      return `stdio|${this.command}|${JSON.stringify(this.args ?? [])}|${JSON.stringify(this.env ?? {})}`
    }
    return `http|${this.url ?? ''}|${JSON.stringify(this.headers ?? {})}`
  }

  private buildTransport(): StreamableHTTPClientTransport | StdioClientTransport {
    if (this.command !== undefined) {
      return new StdioClientTransport({
        command: this.command,
        ...(this.args !== undefined ? { args: this.args } : {}),
        // SDK 传入 env 时不再合并默认环境，这里显式合并，保证 PATH 等基础变量可用
        env: { ...getDefaultEnvironment(), ...(this.env ?? {}) },
      })
    }
    return new StreamableHTTPClientTransport(new URL(this.url ?? ''), {
      ...(this.headers !== undefined ? { requestInit: { headers: this.headers } } : {}),
    })
  }

  /** 惰性连接：SDK 的 connect() 内含标准 initialize / initialized 握手 */
  private getClient(): Promise<Client> {
    if (this.client !== undefined) return Promise.resolve(this.client)
    this.connecting ??= this.connect().finally(() => { this.connecting = undefined })
    return this.connecting
  }

  private async connect(): Promise<Client> {
    const transport = this.buildTransport()
    const client = new Client(CLIENT_INFO)
    // SDK 的 Transport.sessionId 声明为 string | undefined，与本项目的
    // exactOptionalPropertyTypes 冲突（SDK 声明自身问题，skipLibCheck 已开启），
    // 运行时兼容，此处局部断言。
    await client.connect(transport as unknown as Parameters<Client['connect']>[0])
    this.client = client
    return client
  }

  /** 失败后重置连接：下一次调用自动重连并重新握手（stdio 会重新派生进程） */
  private invalidate(): void {
    const stale = this.client
    this.client = undefined
    this.toolsCache = undefined
    if (stale !== undefined) {
      stale.close().catch(() => { /* 连接可能已断开 */ })
    }
  }

  /** 获取工具列表（cursor 分页 + 短缓存，带超时） */
  async listTools(): Promise<McpTool[]> {
    const now = Date.now()
    if (this.toolsCache !== undefined && now < this.cacheExpiresAt) return this.toolsCache

    const client = await this.getClient()
    try {
      const tools: McpTool[] = []
      let cursor: string | undefined
      do {
        const page = await client.listTools(
          cursor !== undefined ? { cursor } : {},
          { timeout: this.timeoutMs },
        )
        for (const t of page.tools) {
          tools.push({
            name: t.name,
            description: t.description ?? '',
            inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
          })
        }
        cursor = page.nextCursor
      } while (cursor !== undefined)
      this.toolsCache = tools
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS
      return tools
    } catch (error) {
      this.invalidate()
      throw error
    }
  }

  /** 调用工具（带超时）；返回结构化结果，区分工具级错误 */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const client = await this.getClient()
    try {
      const result = await client.callTool(
        { name, arguments: args },
        CallToolResultSchema,
        { timeout: this.timeoutMs },
      ) as CallToolResult
      return {
        isError: result.isError === true,
        text: extractText(result.content),
        ...(result.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}),
      }
    } catch (error) {
      this.invalidate()
      throw error
    }
  }

  /** 关闭连接并释放会话（stdio 同时终止子进程） */
  async close(): Promise<void> {
    const stale = this.client
    this.client = undefined
    this.toolsCache = undefined
    if (stale !== undefined) {
      await stale.close().catch(() => { /* 连接可能已断开 */ })
    }
  }
}

/** 管理多个 MCP 客户端 */
export class McpManager {
  private readonly clients = new Map<string, McpClient>()

  /** 注册一个 MCP 服务器；同名但连接参数变化时关闭旧连接并替换。 */
  register(config: McpServerConfig): McpClient {
    const next = new McpClient(config)
    const existing = this.clients.get(config.name)
    if (existing !== undefined) {
      if (existing.fingerprint === next.fingerprint) return existing
      void existing.close()
    }
    this.clients.set(config.name, next)
    return next
  }

  /** 获取所有已注册的客户端 */
  getAll(): McpClient[] {
    return [...this.clients.values()]
  }

  /** 刷新所有缓存的工具列表 */
  async refreshAll(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.listTools()
      } catch (error) {
        console.error(`[mcp] 刷新 ${client.name} 工具列表失败:`, error)
      }
    }
  }

  /** 关闭所有连接（插件卸载时调用） */
  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map(c => c.close()))
    this.clients.clear()
  }
}
