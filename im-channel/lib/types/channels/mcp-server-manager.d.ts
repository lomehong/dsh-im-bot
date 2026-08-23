import { type McpServerConfig } from './wecom/mcp-client.ts';
/** MCP 服务器配置条目 */
export interface McpServerEntry {
    id: string;
    name: string;
    type: string;
    /** streamable-http 服务器地址；stdio 条目为空字符串 */
    url: string;
    enabled: boolean;
    /** stdio 启动命令 */
    command?: string;
    /** stdio 启动参数 */
    args?: string[];
    /** stdio 环境变量 */
    env?: Record<string, string>;
    /** HTTP 附加请求头（如鉴权 token） */
    headers?: Record<string, string>;
}
/** MCP 服务器配置集合 */
export interface McpServersConfig {
    servers: McpServerEntry[];
}
/** 管理操作失败的业务错误（区别于文件系统异常） */
export declare class McpManagerError extends Error {
    readonly code: 'invalid-url' | 'invalid-command' | 'duplicate';
    constructor(message: string, code: 'invalid-url' | 'invalid-command' | 'duplicate');
}
/** 粘贴解析后可直接导入的候选服务器（HTTP 与 stdio 通用） */
export interface McpImportCandidate {
    /** 建议名称（来自 JSON 键名、URL 主机名或命令名；同批重名自动加序号） */
    name: string;
    /** 规范化后的服务器 URL；stdio 候选为空字符串 */
    url: string;
    /** stdio 启动命令 */
    command?: string;
    /** stdio 启动参数 */
    args?: string[];
    /** stdio 环境变量 */
    env?: Record<string, string>;
    /** HTTP 附加请求头 */
    headers?: Record<string, string>;
}
/** 粘贴解析中识别出但当前不支持的配置项 */
export interface McpUnsupportedCandidate {
    name: string;
    rawType: string;
    command: string | undefined;
    reason: string;
}
/** 粘贴解析结果 */
export interface McpImportResult {
    /** 可导入的候选（已去重） */
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
/**
 * 保存 MCP 服务器配置。
 * 原子写入：先写临时文件再 rename，避免写一半崩溃留下损坏配置。
 */
export declare function saveMcpServers(servers: McpServerEntry[]): void;
/** 获取启用的 MCP 服务器 */
export declare function getEnabledMcpServers(): McpServerEntry[];
/** 把已保存的服务器条目转换为客户端连接配置 */
export declare function serverEntryToConfig(server: McpServerEntry): McpServerConfig;
/**
 * 规范化并校验 MCP 服务器 URL。
 * 仅接受 http/https 且带有主机名的绝对地址；不合法时抛 McpManagerError。
 */
export declare function normalizeMcpUrl(url: string): string;
/** 从 URL 推导默认显示名称（取主机名，去掉 www. 前缀） */
export declare function defaultNameFromUrl(url: string): string;
/** 从 stdio 命令推导默认显示名称（取命令 basename，去掉扩展名） */
export declare function defaultNameFromCommand(command: string): string;
/** 添加 MCP 服务器入参：HTTP 传 url，stdio 传 command（+ 可选 args/env）。 */
export interface AddMcpServerInput {
    name?: string;
    type?: string;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    enabled: boolean;
}
/** 添加 MCP 服务器。name 缺省自动生成；配置无效或重复时抛 McpManagerError。 */
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
 *   2. 标准 mcpServers JSON（Claude Code / Cursor / wecom 等客户端格式，
 *      HTTP 与 stdio 条目均可导入，HTTP 条目可携带 headers）
 *   3. 单个服务器 JSON 对象（{ url } / { command } 或 { mcpServers: {...} }）
 * 解析永远不会抛错：无法识别的内容归入 invalid，由前端提示。
 */
export declare function parseMcpImport(text: string): McpImportResult;
/** 连接测试目标：HTTP 传 url，stdio 传 command（+ 可选 args/env） */
export interface McpTestTarget {
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
}
/**
 * 测试一个 MCP 服务器的连通性：按运行时完全相同的方式走
 * initialize 握手 + tools/list，返回可用工具列表。运行时可用的服务器测试必然通过。
 * 兼容旧签名：直接传 URL 字符串等价于 { url }。
 */
export declare function testMcpServer(target: McpTestTarget | string, timeoutMs?: number): Promise<McpTestResult>;
