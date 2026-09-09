/**
 * 通用 MCP Server 管理模块
 *
 * 管理多个 MCP 服务器配置，支持 CRUD 操作。
 * MCP 配置存储在 ~/.dsh/im-channel/credentials/mcp-servers.json
 *
 * 支持两种标准传输（type 字段区分）：
 *   - streamable-http：url + 可选 headers（鉴权等附加请求头）
 *   - stdio：command + 可选 args / env（本地进程）
 *
 * 每个 MCP 服务器包含：
 *   - id: 唯一标识
 *   - name: 显示名称（添加时缺省自动生成：HTTP 取主机名，stdio 取命令名）
 *   - type: 协议类型（streamable-http | stdio）
 *   - url: HTTP 服务器地址（stdio 条目为空字符串）
 *   - enabled: 是否启用
 *   - command / args / env: stdio 启动配置
 *   - headers: HTTP 附加请求头
 *
 * 额外提供「方便添加」能力：
 *   - parseMcpImport: 解析用户粘贴的文本（裸 URL / 多行 URL / 标准
 *     mcpServers JSON 配置，兼容 Claude Code、Cursor 等客户端格式，
 *     HTTP 与 stdio 条目均可导入）
 *   - testMcpServer: 连接测试，探测服务器可达性与可用工具列表
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { McpClient, type McpServerConfig } from './wecom/mcp-client.ts'

/** MCP 服务器配置条目 */
export interface McpServerEntry {
  id: string
  name: string
  type: string
  /** streamable-http 服务器地址；stdio 条目为空字符串 */
  url: string
  enabled: boolean
  /** stdio 启动命令 */
  command?: string
  /** stdio 启动参数 */
  args?: string[]
  /** stdio 环境变量 */
  env?: Record<string, string>
  /** HTTP 附加请求头（如鉴权 token） */
  headers?: Record<string, string>
}

/** MCP 服务器配置集合 */
export interface McpServersConfig {
  servers: McpServerEntry[]
}

/** 管理操作失败的业务错误（区别于文件系统异常） */
export class McpManagerError extends Error {
  constructor(message: string, readonly code: 'invalid-url' | 'invalid-command' | 'duplicate') {
    super(message)
    this.name = 'McpManagerError'
  }
}

/** 粘贴解析后可直接导入的候选服务器（HTTP 与 stdio 通用） */
export interface McpImportCandidate {
  /** 建议名称（来自 JSON 键名、URL 主机名或命令名；同批重名自动加序号） */
  name: string
  /** 规范化后的服务器 URL；stdio 候选为空字符串 */
  url: string
  /** stdio 启动命令 */
  command?: string
  /** stdio 启动参数 */
  args?: string[]
  /** stdio 环境变量 */
  env?: Record<string, string>
  /** HTTP 附加请求头 */
  headers?: Record<string, string>
}

/** 粘贴解析中识别出但当前不支持的配置项 */
export interface McpUnsupportedCandidate {
  name: string
  rawType: string
  command: string | undefined
  reason: string
}

/** 粘贴解析结果 */
export interface McpImportResult {
  /** 可导入的候选（已去重） */
  candidates: McpImportCandidate[]
  /** 识别出但协议不支持的配置项 */
  unsupported: McpUnsupportedCandidate[]
  /** 无法识别的输入片段（按行） */
  invalid: string[]
}

/** 连接测试结果 */
export interface McpTestResult {
  ok: boolean
  toolCount: number | undefined
  tools: Array<{ name: string; description: string }> | undefined
  error: string | undefined
}

function configPath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'credentials', 'mcp-servers.json')
}

/** 加载 MCP 服务器配置 */
export function loadMcpServers(): McpServerEntry[] {
  const path = configPath()
  if (!existsSync(path)) return []
  try {
    const config = JSON.parse(readFileSync(path, 'utf8')) as McpServersConfig
    return config.servers ?? []
  } catch {
    return []
  }
}

/**
 * 保存 MCP 服务器配置。
 * 原子写入：先写临时文件再 rename，避免写一半崩溃留下损坏配置。
 */
export function saveMcpServers(servers: McpServerEntry[]): void {
  const path = configPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify({ servers }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, path)
}

/** 获取启用的 MCP 服务器 */
export function getEnabledMcpServers(): McpServerEntry[] {
  return loadMcpServers().filter(s => s.enabled)
}

/** 把已保存的服务器条目转换为客户端连接配置 */
export function serverEntryToConfig(server: McpServerEntry): McpServerConfig {
  return {
    name: server.name,
    ...(server.url !== '' ? { url: server.url } : {}),
    ...(server.command !== undefined ? { command: server.command } : {}),
    ...(server.args !== undefined ? { args: server.args } : {}),
    ...(server.env !== undefined ? { env: server.env } : {}),
    ...(server.headers !== undefined ? { headers: server.headers } : {}),
  }
}

/** 生成唯一 ID */
function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 校验并净化字符串映射（headers / env）：只保留键非空且值为字符串的项；全空返回 undefined */
function sanitizeStringMap(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key.trim() !== '' && typeof val === 'string') out[key] = val
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 校验并净化参数数组：只保留字符串项；全空返回 undefined */
function sanitizeArgs(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value.filter((item): item is string => typeof item === 'string')
  return out.length > 0 ? out : undefined
}

/** 判断条目 / 输入是否为 stdio 形态（command 非空） */
function isStdioCommand(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * 规范化并校验 MCP 服务器 URL。
 * 仅接受 http/https 且带有主机名的绝对地址；不合法时抛 McpManagerError。
 */
export function normalizeMcpUrl(url: string): string {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new McpManagerError(`URL 不合法: ${trimmed.slice(0, 120)}`, 'invalid-url')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new McpManagerError(`仅支持 http/https 地址（收到 ${parsed.protocol}//）`, 'invalid-url')
  }
  if (parsed.hostname === '') {
    throw new McpManagerError('URL 缺少主机名', 'invalid-url')
  }
  return parsed.href
}

/** 从 URL 推导默认显示名称（取主机名，去掉 www. 前缀） */
export function defaultNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return 'MCP 服务器'
  }
}

/** 从 stdio 命令推导默认显示名称（取命令 basename，去掉扩展名） */
export function defaultNameFromCommand(command: string): string {
  const name = basename(command.trim().replace(/\\/g, '/')).replace(/\.(exe|cmd|bat|sh)$/i, '')
  return name !== '' ? name : 'MCP 服务器'
}

/** 添加 MCP 服务器入参：HTTP 传 url，stdio 传 command（+ 可选 args/env）。 */
export interface AddMcpServerInput {
  name?: string
  type?: string
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
  enabled: boolean
}

/** 添加 MCP 服务器。name 缺省自动生成；配置无效或重复时抛 McpManagerError。 */
export function addMcpServer(entry: AddMcpServerInput): McpServerEntry {
  const servers = loadMcpServers()
  const stdio = isStdioCommand(entry.command)

  let url = ''
  let name: string
  if (stdio) {
    const command = (entry.command as string).trim()
    const args = sanitizeArgs(entry.args)
    const dup = servers.find(s => s.command !== undefined
      && s.command === command
      && JSON.stringify(s.args ?? []) === JSON.stringify(args ?? []))
    if (dup !== undefined) {
      throw new McpManagerError(`该命令已配置（名称: ${dup.name}）`, 'duplicate')
    }
    name = entry.name !== undefined && entry.name.trim() !== '' ? entry.name.trim() : defaultNameFromCommand(command)
    const env = sanitizeStringMap(entry.env)
    const newEntry: McpServerEntry = {
      id: generateId(),
      name,
      type: 'stdio',
      url: '',
      enabled: entry.enabled,
      command,
      ...(args !== undefined ? { args } : {}),
      ...(env !== undefined ? { env } : {}),
    }
    servers.push(newEntry)
    saveMcpServers(servers)
    return newEntry
  }

  if (!isStdioCommand(entry.url)) {
    throw new McpManagerError('需要 url（HTTP）或 command（stdio）', 'invalid-url')
  }
  url = normalizeMcpUrl(entry.url)
  const existing = servers.find(s => s.url === url)
  if (existing !== undefined) {
    throw new McpManagerError(`该 URL 已配置（名称: ${existing.name}）`, 'duplicate')
  }
  name = entry.name !== undefined && entry.name.trim() !== '' ? entry.name.trim() : defaultNameFromUrl(url)
  const headers = sanitizeStringMap(entry.headers)
  const newEntry: McpServerEntry = {
    id: generateId(),
    name,
    type: entry.type !== undefined && entry.type.trim() !== '' ? entry.type.trim() : 'streamable-http',
    url,
    enabled: entry.enabled,
    ...(headers !== undefined ? { headers } : {}),
  }
  servers.push(newEntry)
  saveMcpServers(servers)
  return newEntry
}

/** 更新 MCP 服务器 */
export function updateMcpServer(id: string, updates: Partial<Omit<McpServerEntry, 'id'>>): boolean {
  const servers = loadMcpServers()
  const index = servers.findIndex(s => s.id === id)
  if (index === -1) return false
  const next = { ...servers[index], ...updates }
  if (updates.url !== undefined) next.url = normalizeMcpUrl(updates.url)
  if (updates.command !== undefined) next.command = updates.command.trim()
  // 映射/数组字段统一净化；空值视为删除（headers: {} 即清空）
  const headers = sanitizeStringMap(next.headers)
  if (headers !== undefined) next.headers = headers
  else delete next.headers
  const env = sanitizeStringMap(next.env)
  if (env !== undefined) next.env = env
  else delete next.env
  const args = sanitizeArgs(next.args)
  if (args !== undefined) next.args = args
  else delete next.args
  // type 与实际字段保持一致
  next.type = isStdioCommand(next.command) ? 'stdio' : 'streamable-http'
  const duplicate = servers.some((s, i) => i !== index && s.url !== '' && s.url === next.url)
  if (duplicate) throw new McpManagerError(`该 URL 已被其他服务器使用（${next.url}）`, 'duplicate')
  servers[index] = next
  saveMcpServers(servers)
  return true
}

/** 删除 MCP 服务器 */
export function removeMcpServer(id: string): boolean {
  const servers = loadMcpServers()
  const index = servers.findIndex(s => s.id === id)
  if (index === -1) return false
  servers.splice(index, 1)
  saveMcpServers(servers)
  return true
}

const HTTP_URL_RE = /^https?:\/\/\S+$/i

/** 候选去重键：HTTP 按 URL，stdio 按 command+args */
function candidateKey(candidate: McpImportCandidate): string {
  if (candidate.command !== undefined) {
    return `stdio|${candidate.command}|${JSON.stringify(candidate.args ?? [])}`
  }
  return `http|${candidate.url}`
}

/**
 * 从单个 JSON 对象提取服务器候选。
 * 兼容两种形态：`{ url }` 单服务器对象，或 Claude Code / Cursor 等客户端的
 * `{ mcpServers: { 名称: { url | command, type?, headers?, env? } } }` 包装格式。
 */
function extractFromJson(value: unknown, out: McpImportResult): void {
  if (typeof value !== 'object' || value === null) {
    out.invalid.push(JSON.stringify(value).slice(0, 120))
    return
  }
  const record = value as Record<string, unknown>
  // 标准 mcpServers 包装格式
  if (typeof record.mcpServers === 'object' && record.mcpServers !== null) {
    for (const [key, item] of Object.entries(record.mcpServers as Record<string, unknown>)) {
      if (typeof item !== 'object' || item === null) {
        out.invalid.push(key)
        continue
      }
      pushCandidate(out, key, item as Record<string, unknown>)
    }
    return
  }
  // 单服务器对象：{ name?, url } 或 { name?, command, args? }
  if (typeof record.url === 'string' || typeof record.command === 'string') {
    pushCandidate(out, typeof record.name === 'string' ? record.name : '', record)
    return
  }
  out.invalid.push('JSON 对象中没有找到 mcpServers 或 url/command 字段')
}

/** 把一个 server 配置对象按 url / command 分类地写入结果。 */
function pushCandidate(out: McpImportResult, name: string, item: Record<string, unknown>): void {
  const displayName = name.trim() !== '' ? name.trim() : undefined
  // stdio 形态：command（可带 args / env）
  if (typeof item.command === 'string' && item.command.trim() !== '') {
    const command = item.command.trim()
    const args = sanitizeArgs(item.args)
    const env = sanitizeStringMap(item.env)
    const candidate: McpImportCandidate = {
      name: displayName ?? defaultNameFromCommand(command),
      url: '',
      command,
      ...(args !== undefined ? { args } : {}),
      ...(env !== undefined ? { env } : {}),
    }
    if (!out.candidates.some(c => candidateKey(c) === candidateKey(candidate))) {
      out.candidates.push(candidate)
    }
    return
  }
  // HTTP 形态：url（可带 headers）
  if (typeof item.url === 'string' && item.url.trim() !== '') {
    try {
      const url = normalizeMcpUrl(item.url)
      const headers = sanitizeStringMap(item.headers)
      const candidate: McpImportCandidate = {
        name: displayName ?? defaultNameFromUrl(url),
        url,
        ...(headers !== undefined ? { headers } : {}),
      }
      if (!out.candidates.some(c => candidateKey(c) === candidateKey(candidate))) {
        out.candidates.push(candidate)
      }
    } catch (error) {
      out.invalid.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return
  }
  out.invalid.push(`${name}: 既没有 url 也没有 command`)
}

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
export function parseMcpImport(text: string): McpImportResult {
  const out: McpImportResult = { candidates: [], unsupported: [], invalid: [] }
  const trimmed = text.trim()
  if (trimmed === '') return out

  // 先尝试整体 JSON 解析
  let parsedJson: unknown
  let isJson = true
  try {
    parsedJson = JSON.parse(trimmed)
  } catch {
    isJson = false
  }
  if (isJson) {
    if (Array.isArray(parsedJson)) {
      for (const item of parsedJson) extractFromJson(item, out)
    } else {
      extractFromJson(parsedJson, out)
    }
  } else {
    // 按行识别裸 URL
    for (const line of trimmed.split(/\r?\n/)) {
      const value = line.trim()
      if (value === '') continue
      if (HTTP_URL_RE.test(value)) {
        try {
          const url = normalizeMcpUrl(value)
          const candidate: McpImportCandidate = { name: defaultNameFromUrl(url), url }
          if (!out.candidates.some(c => candidateKey(c) === candidateKey(candidate))) {
            out.candidates.push(candidate)
          }
        } catch (error) {
          out.invalid.push(`${value}: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        out.invalid.push(value.slice(0, 120))
      }
    }
  }

  // 同批名称去重：host、host-2、host-3 …
  const seen = new Set<string>()
  for (const candidate of out.candidates) {
    let name = candidate.name
    let seq = 2
    while (seen.has(name)) {
      name = `${candidate.name}-${seq}`
      seq++
    }
    candidate.name = name
    seen.add(name)
  }
  return out
}

/** 连接测试目标：HTTP 传 url，stdio 传 command（+ 可选 args/env） */
export interface McpTestTarget {
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

/**
 * 测试一个 MCP 服务器的连通性：按运行时完全相同的方式走
 * initialize 握手 + tools/list，返回可用工具列表。运行时可用的服务器测试必然通过。
 * 兼容旧签名：直接传 URL 字符串等价于 { url }。
 */
export async function testMcpServer(target: McpTestTarget | string, timeoutMs = 8000): Promise<McpTestResult> {
  const t: McpTestTarget = typeof target === 'string' ? { url: target } : target
  let client: McpClient
  if (isStdioCommand(t.command)) {
    const args = sanitizeArgs(t.args)
    const env = sanitizeStringMap(t.env)
    client = new McpClient({
      name: 'connection-test',
      command: t.command.trim(),
      ...(args !== undefined ? { args } : {}),
      ...(env !== undefined ? { env } : {}),
      timeoutMs,
    })
  } else {
    let normalized: string
    try {
      normalized = normalizeMcpUrl(t.url ?? '')
    } catch (error) {
      return { ok: false, toolCount: undefined, tools: undefined, error: error instanceof Error ? error.message : String(error) }
    }
    const headers = sanitizeStringMap(t.headers)
    client = new McpClient({
      name: 'connection-test',
      url: normalized,
      ...(headers !== undefined ? { headers } : {}),
      timeoutMs,
    })
  }
  try {
    const tools = await client.listTools()
    return {
      ok: true,
      toolCount: tools.length,
      tools: tools.map(tool => ({ name: tool.name, description: tool.description })),
      error: undefined,
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const friendly = /ENOENT/.test(raw)
      ? '无法启动进程（命令不存在或不在 PATH 中）'
      : /timeout|timed out|aborted/i.test(raw)
        ? `连接超时（${timeoutMs / 1000} 秒内未响应）`
        : /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(raw)
          ? '无法连接（网络不可达或服务器未启动）'
          : raw
    return { ok: false, toolCount: undefined, tools: undefined, error: friendly }
  } finally {
    // 测试用连接用完即弃，避免泄漏会话（stdio 同时终止子进程）
    await client.close().catch(() => { /* 连接可能从未建立 */ })
  }
}
