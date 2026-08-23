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
/** DeepSeek 工具名长度上限 */
const MAX_TOOL_NAME = 64;
/** 服务器名作为工具名片段：非法字符换 _，截断到 32 字符 */
export function sanitizeServerName(name) {
    const cleaned = name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
    return cleaned === '' ? 'server' : cleaned;
}
/** FNV-1a 32-bit：稳定短哈希（8 位十六进制） */
function fnv1aHex(input) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
/** 生成模型可见的 MCP 工具名 */
export function publicMcpToolName(serverName, rawName) {
    const prefix = `mcp__${sanitizeServerName(serverName)}__`;
    const budget = MAX_TOOL_NAME - prefix.length;
    // 常见路径：合法且长度可容纳，直接拼接
    if (/^[A-Za-z0-9_-]+$/.test(rawName) && rawName.length <= budget) {
        return prefix + rawName;
    }
    // 超长或含非法字符：截断 + 哈希后缀，保证稳定且唯一
    const safe = rawName.replace(/[^A-Za-z0-9_-]/g, '_');
    const base = safe.slice(0, Math.max(1, budget - 9));
    return `${prefix}${base}_${fnv1aHex(rawName)}`;
}
