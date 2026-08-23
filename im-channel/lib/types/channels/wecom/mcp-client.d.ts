/** MCP 工具定义 */
export interface McpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
/** MCP 服务器配置：url 与 command 二选一，分别对应 HTTP / stdio 传输 */
export interface McpServerConfig {
    name: string;
    /** Streamable HTTP 服务器地址 */
    url?: string;
    /** stdio 启动命令 */
    command?: string;
    /** stdio 启动参数 */
    args?: string[];
    /** stdio 环境变量（叠加在默认环境之上） */
    env?: Record<string, string>;
    /** 附加请求头（仅 HTTP，如鉴权 token） */
    headers?: Record<string, string>;
    /** 单次请求超时（毫秒），缺省 60 秒 */
    timeoutMs?: number;
}
/** 工具调用结果 */
export interface McpCallResult {
    /** 工具自身报错（协议级 isError 标志） */
    isError: boolean;
    /** 合并后的文本内容 */
    text: string;
    /** 服务器返回的 structuredContent（若有） */
    structuredContent?: unknown;
}
/** MCP 客户端（HTTP / stdio 双传输） */
export declare class McpClient {
    private readonly serverName;
    private readonly url;
    private readonly command;
    private readonly args;
    private readonly env;
    private readonly headers;
    private readonly timeoutMs;
    private client;
    private connecting;
    private toolsCache;
    private cacheExpiresAt;
    constructor(config: McpServerConfig);
    get name(): string;
    /** 连接指纹：任一连接参数变化即需要换连接 */
    get fingerprint(): string;
    private buildTransport;
    /** 惰性连接：SDK 的 connect() 内含标准 initialize / initialized 握手 */
    private getClient;
    private connect;
    /** 失败后重置连接：下一次调用自动重连并重新握手（stdio 会重新派生进程） */
    private invalidate;
    /** 获取工具列表（cursor 分页 + 短缓存，带超时） */
    listTools(): Promise<McpTool[]>;
    /** 调用工具（带超时）；返回结构化结果，区分工具级错误 */
    callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
    /** 关闭连接并释放会话（stdio 同时终止子进程） */
    close(): Promise<void>;
}
/** 管理多个 MCP 客户端 */
export declare class McpManager {
    private readonly clients;
    /** 注册一个 MCP 服务器；同名但连接参数变化时关闭旧连接并替换。 */
    register(config: McpServerConfig): McpClient;
    /** 获取所有已注册的客户端 */
    getAll(): McpClient[];
    /** 刷新所有缓存的工具列表 */
    refreshAll(): Promise<void>;
    /** 关闭所有连接（插件卸载时调用） */
    closeAll(): Promise<void>;
}
