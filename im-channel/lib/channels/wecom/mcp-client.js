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
/** MCP 客户端 */
export class McpClient {
    serverName;
    url;
    requestId = 1;
    toolsCache;
    cacheExpiresAt = 0;
    static CACHE_TTL_MS = 60_000; // 1 分钟
    constructor(config) {
        this.serverName = config.name;
        this.url = config.url;
    }
    get name() {
        return this.serverName;
    }
    get serverUrl() {
        return this.url;
    }
    /** 发送 JSON-RPC 请求 */
    async request(method, params) {
        const id = this.requestId++;
        const body = JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            ...(params ? { params } : {}),
        });
        const response = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body,
        });
        if (!response.ok) {
            throw new Error(`MCP 请求失败: ${response.status} ${response.statusText}`);
        }
        const result = (await response.json());
        if (result.error !== undefined) {
            throw new Error(`MCP 错误 [${result.error.code}]: ${result.error.message}`);
        }
        if (result.result === undefined) {
            throw new Error('MCP 响应缺少 result 字段');
        }
        return result.result;
    }
    /** 获取工具列表（带缓存） */
    async listTools() {
        const now = Date.now();
        if (this.toolsCache !== undefined && now < this.cacheExpiresAt) {
            return this.toolsCache;
        }
        const result = await this.request('tools/list');
        this.toolsCache = result.tools ?? [];
        this.cacheExpiresAt = now + McpClient.CACHE_TTL_MS;
        return this.toolsCache;
    }
    /** 调用工具 */
    async callTool(name, arguments_) {
        const result = await this.request('tools/call', {
            name,
            arguments: arguments_,
        });
        // 合并返回内容
        return (result.content ?? [])
            .map(item => item.text ?? '')
            .filter(Boolean)
            .join('\n');
    }
}
/** 管理多个 MCP 客户端 */
export class McpManager {
    clients = new Map();
    /** 注册一个 MCP 服务器；同名但 URL 变化时替换为新客户端。 */
    register(config) {
        const existing = this.clients.get(config.name);
        if (existing !== undefined && existing.serverUrl === config.url)
            return existing;
        const client = new McpClient(config);
        this.clients.set(config.name, client);
        return client;
    }
    /** 获取所有已注册的客户端 */
    getAll() {
        return [...this.clients.values()];
    }
    /** 刷新所有缓存的工具列表 */
    async refreshAll() {
        for (const client of this.clients.values()) {
            try {
                await client.listTools();
            }
            catch (error) {
                console.error(`[mcp] 刷新 ${client.name} 工具列表失败:`, error);
            }
        }
    }
}
