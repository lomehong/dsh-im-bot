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
/** 加载 MCP 服务器配置 */
export declare function loadMcpServers(): McpServerEntry[];
/** 保存 MCP 服务器配置 */
export declare function saveMcpServers(servers: McpServerEntry[]): void;
/** 获取启用的 MCP 服务器 */
export declare function getEnabledMcpServers(): McpServerEntry[];
/** 添加 MCP 服务器 */
export declare function addMcpServer(entry: Omit<McpServerEntry, 'id'>): McpServerEntry;
/** 更新 MCP 服务器 */
export declare function updateMcpServer(id: string, updates: Partial<Omit<McpServerEntry, 'id'>>): boolean;
/** 删除 MCP 服务器 */
export declare function removeMcpServer(id: string): boolean;
