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
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
/** MCP 服务器配置 */
export interface McpServerConfig {
    name: string;
    url: string;
    /** 单次请求超时（毫秒）；缺省不限制（保持既有行为）。连接测试时建议设置。 */
    timeoutMs?: number;
}
/** MCP 客户端 */
export declare class McpClient {
    private readonly serverName;
    private readonly url;
    private readonly timeoutMs;
    private requestId;
    private toolsCache;
    private cacheExpiresAt;
    private static readonly CACHE_TTL_MS;
    constructor(config: McpServerConfig);
    get name(): string;
    get serverUrl(): string;
    /** 发送 JSON-RPC 请求 */
    private request;
    /** 获取工具列表（带缓存） */
    listTools(): Promise<McpTool[]>;
    /** 调用工具 */
    callTool(name: string, arguments_: Record<string, unknown>): Promise<string>;
}
/** 管理多个 MCP 客户端 */
export declare class McpManager {
    private readonly clients;
    /** 注册一个 MCP 服务器；同名但 URL 变化时替换为新客户端。 */
    register(config: McpServerConfig): McpClient;
    /** 获取所有已注册的客户端 */
    getAll(): McpClient[];
    /** 刷新所有缓存的工具列表 */
    refreshAll(): Promise<void>;
}
