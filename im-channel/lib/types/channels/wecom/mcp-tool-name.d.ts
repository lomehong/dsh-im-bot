/**
 * MCP 工具命名
 *
 * 模型可见的工具名统一采用官方约定 `mcp__<serverName>__<rawName>`
 * （与 DSH 官方 dsh-mcp-client、Claude Code / Codex 等一致），
 * 便于按前缀做权限白名单（如 `mcp__wecom*`）。
 *
 * 工具名须满足 DeepSeek 约束：最长 64 字符、仅含 [A-Za-z0-9_-]。
 * 原始名超长或含非法字符时，截断并追加稳定哈希后缀，
 * 保证同一工具每次归一化到同一个名字。
 */
/** 服务器名作为工具名片段：非法字符换 _，截断到 32 字符 */
export declare function sanitizeServerName(name: string): string;
/** 生成模型可见的 MCP 工具名 */
export declare function publicMcpToolName(serverName: string, rawName: string): string;
