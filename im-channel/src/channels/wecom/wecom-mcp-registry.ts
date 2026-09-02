/**
 * MCP 工具注册
 *
 * 将通用 MCP 服务器提供的工具注册到 DSH agent 的 tool 系统中，
 * 使 agent 可以直接调用。模型可见的工具名统一采用官方约定
 * `mcp__<serverName>__<rawName>`（与 DSH 官方 dsh-mcp-client 一致），
 * 便于按前缀做访客权限白名单（如 `mcp__wecom*` 放行整个命名空间）。
 */
import type { Context } from '@deepseek-ai/cordis'
// alpha.3 起 JsonValue 从 @deepseek-ai/dsh-session 迁到 @deepseek-ai/dsh-util-values。
// 早期 dsh-session 透传过 JsonValue，新版本断开了——这里直取下层 util-values 包避免版本耦合。
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { getEnabledMcpServers, serverEntryToConfig } from '../mcp-server-manager.ts'
import { McpManager, type McpClient, type McpServerConfig, type McpTool } from './mcp-client.ts'
import { publicMcpToolName } from './mcp-tool-name.ts'

/** 管理 MCP 工具注册 */
export class WecomMcpRegistry {
  private readonly mcpManager = new McpManager()
  /** 全局注册产生的 disposer，供插件卸载/重载时清理 */
  private globalDisposers: Array<() => void> = []

  /** 注册 MCP 服务器配置 */
  registerServer(config: McpServerConfig): void {
    this.mcpManager.register(config)
  }

  /**
   * 从通用 MCP 服务器管理文件（mcp-servers.json）同步已启用的服务器。
   * 设置页新增/修改/删除服务器后无需重启即可在下一个 agent 会话生效。
   */
  syncFromServerFile(): void {
    for (const server of getEnabledMcpServers()) {
      this.mcpManager.register(serverEntryToConfig(server))
    }
  }

  /** 将 MCP 工具注册到 agent 上下文（每个 agent 独立注册） */
  async registerToAgent(agentCtx: Context): Promise<void> {
    // 每次 agent 建立时同步最新服务器配置，避免设置页改动要重启才生效
    this.syncFromServerFile()
    // 同一 agent 内工具名必须唯一：跨服务器重名时跳过并告警
    const usedNames = new Set<string>()
    for (const client of this.mcpManager.getAll()) {
      try {
        const tools = await client.listTools()
        if (tools.length === 0) continue

        for (const tool of tools) {
          const toolName = publicMcpToolName(client.name, tool.name)
          if (usedNames.has(toolName)) {
            this.log(`跳过重名工具 ${toolName} (${client.name})`)
            continue
          }
          const definition = this.buildDefinition(client, tool)

          try {
            // @ts-expect-error - DSH tool register API
            agentCtx.tools?.register?.(definition)
            usedNames.add(toolName)
            this.log(`注册 MCP 工具: ${toolName} (${client.name})`)
          } catch (registerError) {
            this.log(`注册 MCP 工具失败 ${toolName}: ${registerError instanceof Error ? registerError.message : String(registerError)}`)
          }
        }
      } catch (error) {
        this.log(`获取 MCP 工具列表失败 ${client.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * 将 MCP 工具注册到全局 tools 服务（宿主根层），使**任何通道**创建的
   * agent 会话（Web / IM / headless / 子代理）都能看到这些工具。
   *
   * 工具名沿用官方 `mcp__<serverName>__<rawName>` 命名，server 前缀天然
   * 避免跨服务器重名；先清理上一代注册再持有新一代（重载安全）。
   */
  async registerGlobal(rootCtx: Context): Promise<void> {
    // 先清理上一代注册（重载/reload 场景），避免旧注册未清理导致撞名
    this.disposeGlobal()
    this.syncFromServerFile()
    const disposers: Array<() => void> = []
    for (const client of this.mcpManager.getAll()) {
      try {
        const tools = await client.listTools()
        if (tools.length === 0) continue

        for (const tool of tools) {
          const toolName = publicMcpToolName(client.name, tool.name)
          const definition = this.buildDefinition(client, tool)
          try {
            // @ts-expect-error - DSH tool register API
            const dispose = rootCtx.tools?.register?.(definition)
            if (typeof dispose === 'function') {
              disposers.push(dispose)
              this.log(`全局注册 MCP 工具: ${toolName} (${client.name})`)
            }
          } catch (registerError) {
            this.log(`全局注册 MCP 工具失败 ${toolName}: ${registerError instanceof Error ? registerError.message : String(registerError)}`)
          }
        }
      } catch (error) {
        this.log(`获取 MCP 工具列表失败 ${client.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    this.globalDisposers = disposers
  }

  /** 注销全部全局注册的 MCP 工具（插件卸载 / 重载时调用） */
  disposeGlobal(): void {
    for (const dispose of this.globalDisposers) {
      try { dispose() } catch { /* 清理失败不影响流程 */ }
    }
    this.globalDisposers = []
  }

  /** 重载：注销旧注册后按最新配置重新全局注册（reload() 时调用） */
  async resyncGlobal(rootCtx: Context): Promise<void> {
    this.disposeGlobal()
    await this.registerGlobal(rootCtx)
  }

  /** 构造单个 MCP 工具的 ToolDefinition（per-agent 与全局注册共用） */
  private buildDefinition(client: McpClient, tool: McpTool): Record<string, unknown> {
    const toolName = publicMcpToolName(client.name, tool.name)
    const toolDescription = tool.description || `${client.name} 工具`
    const inputSchema = tool.inputSchema ?? {}

    return {
      name: toolName,
      description: toolDescription,
      // 直接使用 MCP 的 inputSchema 作为参数 schema
      parameters: inputSchema,
      output: {
        schema: { type: 'object' as const },
        render: (_args: unknown, value: JsonValue): Array<{ type: string; text: string }> => {
          const text = typeof value === 'object' && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value ?? '')
          return [{ type: 'text' as const, text }]
        },
      },
      execute: async (args: unknown, _exec: unknown): Promise<JsonValue> => {
        const result = await client.callTool(tool.name, (args ?? {}) as Record<string, unknown>)
        if (result.isError) {
          return { ok: false, error: result.text || 'MCP 工具返回错误' }
        }
        return {
          ok: true,
          result: result.text,
          ...(result.structuredContent !== undefined ? { structured: result.structuredContent as JsonValue } : {}),
        }
      },
      isConcurrencySafe: (): boolean => true,
    }
  }

  private log(message: string): void {
    console.log(`[wecom-mcp] ${message}`)
  }
}
