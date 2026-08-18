import { McpManager } from "./mcp-client.js";
/** 管理 MCP 工具注册 */
export class WecomMcpRegistry {
    mcpManager = new McpManager();
    /** 注册 MCP 服务器配置 */
    registerServer(config) {
        this.mcpManager.register(config);
    }
    /** 将 MCP 工具注册到 agent 上下文（每个 agent 独立注册） */
    async registerToAgent(agentCtx) {
        const clients = this.mcpManager.getAll();
        for (const client of clients) {
            try {
                const tools = await client.listTools();
                if (tools.length === 0)
                    continue;
                for (const tool of tools) {
                    const toolName = tool.name;
                    const toolDescription = tool.description || `${client.name} 工具`;
                    const inputSchema = tool.inputSchema ?? {};
                    // 创建 ToolDefinition
                    const definition = {
                        name: toolName,
                        description: toolDescription,
                        // 直接使用 MCP 的 inputSchema 作为参数 schema
                        parameters: inputSchema,
                        output: {
                            schema: { type: 'object' },
                            render: (_args, value) => {
                                const text = typeof value === 'object' && value !== null
                                    ? JSON.stringify(value, null, 2)
                                    : String(value ?? '');
                                return [{ type: 'text', text }];
                            },
                        },
                        execute: async (args, _exec) => {
                            const result = await client.callTool(toolName, (args ?? {}));
                            return { result };
                        },
                        isConcurrencySafe: () => true,
                    };
                    try {
                        // @ts-expect-error - DSH tool register API
                        const dispose = agentCtx.tools?.register?.(definition);
                        if (typeof dispose === 'function') {
                            this.log(`注册 MCP 工具: ${toolName} (${client.name})`);
                        }
                    }
                    catch (registerError) {
                        this.log(`注册 MCP 工具失败 ${toolName}: ${registerError instanceof Error ? registerError.message : String(registerError)}`);
                    }
                }
            }
            catch (error) {
                this.log(`获取 MCP 工具列表失败 ${client.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    log(message) {
        console.log(`[wecom-mcp] ${message}`);
    }
}
