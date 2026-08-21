/**
 * 通用 MCP Server 管理模块
 *
 * 管理多个 MCP 服务器配置，支持 CRUD 操作。
 * MCP 配置存储在 ~/.dsh/im-channel/credentials/mcp-servers.json
 *
 * 每个 MCP 服务器包含：
 *   - id: 唯一标识
 *   - name: 显示名称（添加时缺省从 URL 主机名自动生成）
 *   - type: 协议类型（目前仅支持 streamable-http）
 *   - url: MCP 服务器 URL（添加时校验合法性并检测重复）
 *   - enabled: 是否启用
 *
 * 额外提供「方便添加」能力：
 *   - parseMcpImport: 解析用户粘贴的文本（裸 URL / 多行 URL / 标准
 *     mcpServers JSON 配置，兼容 Claude Code、Cursor 等客户端格式）
 *   - testMcpServer: 连接测试，探测服务器可达性与可用工具列表
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpClient } from "./wecom/mcp-client.js";
/** 管理操作失败的业务错误（区别于文件系统异常） */
export class McpManagerError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'McpManagerError';
    }
}
function configPath() {
    return join(homedir(), '.dsh', 'im-channel', 'credentials', 'mcp-servers.json');
}
/** 加载 MCP 服务器配置 */
export function loadMcpServers() {
    const path = configPath();
    if (!existsSync(path))
        return [];
    try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        return config.servers ?? [];
    }
    catch {
        return [];
    }
}
/** 保存 MCP 服务器配置 */
export function saveMcpServers(servers) {
    const path = configPath();
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ servers }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}
/** 获取启用的 MCP 服务器 */
export function getEnabledMcpServers() {
    return loadMcpServers().filter(s => s.enabled);
}
/** 生成唯一 ID */
function generateId() {
    return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
/**
 * 规范化并校验 MCP 服务器 URL。
 * 仅接受 http/https 且带有主机名的绝对地址；不合法时抛 McpManagerError。
 */
export function normalizeMcpUrl(url) {
    const trimmed = url.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        throw new McpManagerError(`URL 不合法: ${trimmed.slice(0, 120)}`, 'invalid-url');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new McpManagerError(`仅支持 http/https 地址（收到 ${parsed.protocol}//）`, 'invalid-url');
    }
    if (parsed.hostname === '') {
        throw new McpManagerError('URL 缺少主机名', 'invalid-url');
    }
    return parsed.href;
}
/** 从 URL 推导默认显示名称（取主机名，去掉 www. 前缀） */
export function defaultNameFromUrl(url) {
    try {
        const host = new URL(url).hostname;
        return host.startsWith('www.') ? host.slice(4) : host;
    }
    catch {
        return 'MCP 服务器';
    }
}
/** 添加 MCP 服务器。name 缺省自动生成；URL 无效或重复时抛 McpManagerError。 */
export function addMcpServer(entry) {
    const url = normalizeMcpUrl(entry.url);
    const servers = loadMcpServers();
    const existing = servers.find(s => s.url === url);
    if (existing !== undefined) {
        throw new McpManagerError(`该 URL 已配置（名称: ${existing.name}）`, 'duplicate');
    }
    const name = entry.name !== undefined && entry.name.trim() !== '' ? entry.name.trim() : defaultNameFromUrl(url);
    const newEntry = {
        id: generateId(),
        name,
        type: entry.type !== undefined && entry.type.trim() !== '' ? entry.type.trim() : 'streamable-http',
        url,
        enabled: entry.enabled,
    };
    servers.push(newEntry);
    saveMcpServers(servers);
    return newEntry;
}
/** 更新 MCP 服务器 */
export function updateMcpServer(id, updates) {
    const servers = loadMcpServers();
    const index = servers.findIndex(s => s.id === id);
    if (index === -1)
        return false;
    const next = { ...servers[index], ...updates };
    if (updates.url !== undefined)
        next.url = normalizeMcpUrl(updates.url);
    const duplicate = servers.some((s, i) => i !== index && s.url === next.url);
    if (duplicate)
        throw new McpManagerError(`该 URL 已被其他服务器使用（${next.url}）`, 'duplicate');
    servers[index] = next;
    saveMcpServers(servers);
    return true;
}
/** 删除 MCP 服务器 */
export function removeMcpServer(id) {
    const servers = loadMcpServers();
    const index = servers.findIndex(s => s.id === id);
    if (index === -1)
        return false;
    servers.splice(index, 1);
    saveMcpServers(servers);
    return true;
}
const HTTP_URL_RE = /^https?:\/\/\S+$/i;
/**
 * 从单个 JSON 对象提取服务器候选。
 * 兼容两种形态：`{ url }` 单服务器对象，或 Claude Code / Cursor 等客户端的
 * `{ mcpServers: { 名称: { url | command, type? } } }` 包装格式。
 */
function extractFromJson(value, out) {
    if (typeof value !== 'object' || value === null) {
        out.invalid.push(JSON.stringify(value).slice(0, 120));
        return;
    }
    const record = value;
    // 标准 mcpServers 包装格式
    if (typeof record.mcpServers === 'object' && record.mcpServers !== null) {
        for (const [key, item] of Object.entries(record.mcpServers)) {
            if (typeof item !== 'object' || item === null) {
                out.invalid.push(key);
                continue;
            }
            pushCandidate(out, key, item);
        }
        return;
    }
    // 单服务器对象：{ name?, url } 或 { name?, command, args? }
    if (typeof record.url === 'string' || typeof record.command === 'string') {
        pushCandidate(out, typeof record.name === 'string' ? record.name : '', record);
        return;
    }
    out.invalid.push('JSON 对象中没有找到 mcpServers 或 url/command 字段');
}
/** 把一个 server 配置对象按 url / command 分类写入结果。 */
function pushCandidate(out, name, item) {
    const rawType = typeof item.type === 'string' ? item.type : (typeof item.url === 'string' ? 'streamable-http' : 'stdio');
    if (typeof item.url === 'string' && item.url.trim() !== '') {
        try {
            const url = normalizeMcpUrl(item.url);
            if (out.candidates.some(c => c.url === url))
                return; // 同批 URL 去重
            out.candidates.push({ name: name.trim() !== '' ? name.trim() : defaultNameFromUrl(url), url });
        }
        catch (error) {
            out.invalid.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        }
        return;
    }
    // 无 url：stdio 形态（command/args）或损坏配置
    const command = typeof item.command === 'string' ? item.command : undefined;
    if (command !== undefined || rawType === 'stdio') {
        out.unsupported.push({
            name: name.trim() !== '' ? name.trim() : '未命名',
            rawType,
            command,
            reason: '暂不支持 stdio 本地进程协议，仅支持 HTTP 流式（url）服务器',
        });
        return;
    }
    out.invalid.push(`${name}: 既没有 url 也没有 command`);
}
/**
 * 解析用户粘贴的文本为可导入的 MCP 服务器候选列表。
 *
 * 支持：
 *   1. 裸 URL（一行一个，可多行）
 *   2. 标准 mcpServers JSON（Claude Code / Cursor / wecom 等客户端格式）
 *   3. 单个服务器 JSON 对象（{ url } 或 { mcpServers: {...} }）
 * 解析永远不会抛错：无法识别的内容归入 invalid，由前端提示。
 */
export function parseMcpImport(text) {
    const out = { candidates: [], unsupported: [], invalid: [] };
    const trimmed = text.trim();
    if (trimmed === '')
        return out;
    // 先尝试整体 JSON 解析
    let parsedJson;
    let isJson = true;
    try {
        parsedJson = JSON.parse(trimmed);
    }
    catch {
        isJson = false;
    }
    if (isJson) {
        if (Array.isArray(parsedJson)) {
            for (const item of parsedJson)
                extractFromJson(item, out);
        }
        else {
            extractFromJson(parsedJson, out);
        }
    }
    else {
        // 按行识别裸 URL
        for (const line of trimmed.split(/\r?\n/)) {
            const value = line.trim();
            if (value === '')
                continue;
            if (HTTP_URL_RE.test(value)) {
                try {
                    const url = normalizeMcpUrl(value);
                    if (out.candidates.some(c => c.url === url))
                        continue;
                    out.candidates.push({ name: defaultNameFromUrl(url), url });
                }
                catch (error) {
                    out.invalid.push(`${value}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            else {
                out.invalid.push(value.slice(0, 120));
            }
        }
    }
    // 同批名称去重：host、host-2、host-3 …
    const seen = new Set();
    for (const candidate of out.candidates) {
        let name = candidate.name;
        let seq = 2;
        while (seen.has(name)) {
            name = `${candidate.name}-${seq}`;
            seq++;
        }
        candidate.name = name;
        seen.add(name);
    }
    return out;
}
/**
 * 测试一个 MCP 服务器 URL 的连通性：按运行时完全相同的方式调用
 * tools/list，返回可用工具列表。运行时可用的服务器测试必然通过。
 */
export async function testMcpServer(url, timeoutMs = 8000) {
    let normalized;
    try {
        normalized = normalizeMcpUrl(url);
    }
    catch (error) {
        return { ok: false, toolCount: undefined, tools: undefined, error: error instanceof Error ? error.message : String(error) };
    }
    const client = new McpClient({ name: 'connection-test', url: normalized, timeoutMs });
    try {
        const tools = await client.listTools();
        return {
            ok: true,
            toolCount: tools.length,
            tools: tools.map(t => ({ name: t.name, description: t.description })),
            error: undefined,
        };
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const friendly = raw.includes('TimeoutError') || raw.includes('aborted')
            ? `连接超时（${timeoutMs / 1000} 秒内未响应）`
            : raw.includes('fetch failed')
                ? '无法连接（网络不可达或服务器未启动）'
                : raw;
        return { ok: false, toolCount: undefined, tools: undefined, error: friendly };
    }
}
