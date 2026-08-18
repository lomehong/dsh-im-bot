/**
 * 企业微信 MCP 工具注册
 *
 * 将企业微信智能机器人提供的 MCP 工具注册到 DSH agent 的 tool 系统中，
 * 使 agent 可以直接调用企业微信的日程、待办、会议等能力。
 */
import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { McpClient, McpManager, type McpServerConfig } from './mcp-client.ts'

/** 管理 MCP 工具注册 */
export class WecomMcpRegistry {
  private readonly mcpManager = new McpManager()

  /** 注册 MCP 服务器配置 */
  registerServer(config: McpServerConfig): void {
    this.mcpManager.register(config)
  }

  /** 将 MCP 工具注册到 agent 上下文（每个 agent 独立注册） */
  async registerToAgent(agentCtx: Context): Promise<void> {
    const clients = this.mcpManager.getAll()
    for (const client of clients) {
      try {
        const tools = await client.listTools()
        if (tools.length === 0) continue

        for (const tool of tools) {
          const toolName = tool.name
          const toolDescription = tool.description || `${client.name} 工具`
          const inputSchema = tool.inputSchema as Record<string, unknown> ?? {}

          // 创建 ToolDefinition
          const definition = {
            name: toolName,
            description: toolDescription,
            // 直接使用 MCP 的 inputSchema 作为参数 schema
            parameters: inputSchema as Record<string, unknown>,
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
              const result = await client.callTool(toolName, (args ?? {}) as Record<string, unknown>)
              return { result }
            },
            isConcurrencySafe: (): boolean => true,
          }

          try {
            // @ts-expect-error - DSH tool register API
            const dispose = agentCtx.tools?.register?.(definition)
            if (typeof dispose === 'function') {
              this.log(`注册 MCP 工具: ${toolName} (${client.name})`)
            }
          } catch (registerError) {
            this.log(`注册 MCP 工具失败 ${toolName}: ${registerError instanceof Error ? registerError.message : String(registerError)}`)
          }
        }
      } catch (error) {
        this.log(`获取 MCP 工具列表失败 ${client.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  private log(message: string): void {
    console.log(`[wecom-mcp] ${message}`)
  }
}