/** MCP 服务器配置 */
export interface McpServerEntry {
    id: string;
    name: string;
    type: string;
    url: string;
    enabled: boolean;
}
/** MCP 服务器配置集合 */
export interface McpServersConfig {
    servers: McpServerEntry[];
}
/** 管理操作失败的业务错误（区别于文件系统异常） */
export declare class McpManagerError extends Error {
    readonly code: 'invalid-url' | 'duplicate';
    constructor(message: string, code: 'invalid-url' | 'duplicate');
}
/** 粘贴解析后可直接导入的候选服务器 */
export interface McpImportCandidate {
    /** 建议名称（来自 JSON 键名或 URL 主机名；同批重名自动加序号） */
    name: string;
    /** 规范化后的服务器 URL */
    url: string;
}
/** 粘贴解析中识别出但当前不支持的配置项（如 stdio） */
export interface McpUnsupportedCandidate {
    name: string;
    rawType: string;
    command: string | undefined;
    reason: string;
}
/** 粘贴解析结果 */
export interface McpImportResult {
    /** 可导入的候选（已按 URL 去重、名称去重） */
    candidates: McpImportCandidate[];
    /** 识别出但协议不支持的配置项 */
    unsupported: McpUnsupportedCandidate[];
    /** 无法识别的输入片段（按行） */
    invalid: string[];
}
/** 连接测试结果 */
export interface McpTestResult {
    ok: boolean;
    toolCount: number | undefined;
    tools: Array<{
        name: string;
        description: string;
    }> | undefined;
    error: string | undefined;
}
/** 加载 MCP 服务器配置 */
export declare function loadMcpServers(): McpServerEntry[];
/** 保存 MCP 服务器配置 */
export declare function saveMcpServers(servers: McpServerEntry[]): void;
/** 获取启用的 MCP 服务器 */
export declare function getEnabledMcpServers(): McpServerEntry[];
/**
 * 规范化并校验 MCP 服务器 URL。
 * 仅接受 http/https 且带有主机名的绝对地址；不合法时抛 McpManagerError。
 */
export declare function normalizeMcpUrl(url: string): string;
/** 从 URL 推导默认显示名称（取主机名，去掉 www. 前缀） */
export declare function defaultNameFromUrl(url: string): string;
/** 添加 MCP 服务器入参：name 可省略（自动从 URL 生成）。 */
export interface AddMcpServerInput {
    name?: string;
    type?: string;
    url: string;
    enabled: boolean;
}
/** 添加 MCP 服务器。name 缺省自动生成；URL 无效或重复时抛 McpManagerError。 */
export declare function addMcpServer(entry: AddMcpServerInput): McpServerEntry;
/** 更新 MCP 服务器 */
export declare function updateMcpServer(id: string, updates: Partial<Omit<McpServerEntry, 'id'>>): boolean;
/** 删除 MCP 服务器 */
export declare function removeMcpServer(id: string): boolean;
/**
 * 解析用户粘贴的文本为可导入的 MCP 服务器候选列表。
 *
 * 支持：
 *   1. 裸 URL（一行一个，可多行）
 *   2. 标准 mcpServers JSON（Claude Code / Cursor / wecom 等客户端格式）
 *   3. 单个服务器 JSON 对象（{ url } 或 { mcpServers: {...} }）
 * 解析永远不会抛错：无法识别的内容归入 invalid，由前端提示。
 */
export declare function parseMcpImport(text: string): McpImportResult;
/**
 * 测试一个 MCP 服务器 URL 的连通性：按运行时完全相同的方式调用
 * tools/list，返回可用工具列表。运行时可用的服务器测试必然通过。
 */
export declare function testMcpServer(url: string, timeoutMs?: number): Promise<McpTestResult>;
