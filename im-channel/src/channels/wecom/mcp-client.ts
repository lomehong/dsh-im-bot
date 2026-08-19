/**
 * 企业微信 MCP 客户端
 *
 * 通过 MCP（Model Context Protocol）调用企业微信智能机器人提供的工具，
 * 如日程、待办、会议等。
 *
 * MCP 协议采用 JSON-RPC 2.0 over HTTP：
 *   - tools/list: 获取可用工具列表
 *   - tools/call: 调用工具
 *
 * 参考：https://modelcontextprotocol.io
 */

/** MCP 工具定义 */
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

/** MCP 服务器配置 */
export interface McpServerConfig {
  name: string
  url: string
}

/** MCP 客户端 */
export class McpClient {
  private readonly serverName: string
  private readonly url: string
  private requestId = 1
  private toolsCache: McpTool[] | undefined
  private cacheExpiresAt = 0
  private static readonly CACHE_TTL_MS = 60_000 // 1 分钟

  constructor(config: McpServerConfig) {
    this.serverName = config.name
    this.url = config.url
  }

  get name(): string {
    return this.serverName
  }

  get serverUrl(): string {
    return this.url
  }

  /** 发送 JSON-RPC 请求 */
  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.requestId++
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      ...(params ? { params } : {}),
    })
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body,
    })
    if (!response.ok) {
      throw new Error(`MCP 请求失败: ${response.status} ${response.statusText}`)
    }
    const result = (await response.json()) as {
      jsonrpc: string
      id: number
      result?: { tools?: McpTool[]; content?: Array<{ type: string; text?: string }> }
      error?: { code: number; message: string }
    }
    if (result.error !== undefined) {
      throw new Error(`MCP 错误 [${result.error.code}]: ${result.error.message}`)
    }
    if (result.result === undefined) {
      throw new Error('MCP 响应缺少 result 字段')
    }
    return result.result as T
  }

  /** 获取工具列表（带缓存） */
  async listTools(): Promise<McpTool[]> {
    const now = Date.now()
    if (this.toolsCache !== undefined && now < this.cacheExpiresAt) {
      return this.toolsCache
    }
    const result = await this.request<{ tools: McpTool[] }>('tools/list')
    this.toolsCache = result.tools ?? []
    this.cacheExpiresAt = now + McpClient.CACHE_TTL_MS
    return this.toolsCache
  }

  /** 调用工具 */
  async callTool(name: string, arguments_: Record<string, unknown>): Promise<string> {
    const result = await this.request<{ content: Array<{ type: string; text?: string }> }>('tools/call', {
      name,
      arguments: arguments_,
    })
    // 合并返回内容
    return (result.content ?? [])
      .map(item => item.text ?? '')
      .filter(Boolean)
      .join('\n')
  }
}

/** 管理多个 MCP 客户端 */
export class McpManager {
  private readonly clients = new Map<string, McpClient>()

  /** 注册一个 MCP 服务器；同名但 URL 变化时替换为新客户端。 */
  register(config: McpServerConfig): McpClient {
    const existing = this.clients.get(config.name)
    if (existing !== undefined && existing.serverUrl === config.url) return existing
    const client = new McpClient(config)
    this.clients.set(config.name, client)
    return client
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
}