/**
 * 通用 MCP Server 管理模块
 *
 * 管理多个 MCP 服务器配置，支持 CRUD 操作。
 * MCP 配置存储在 ~/.dsh/im-channel/credentials/mcp-servers.json
 *
 * 每个 MCP 服务器包含：
 *   - id: 唯一标识
 *   - name: 显示名称
 *   - type: 协议类型（目前仅支持 streamable-http）
 *   - url: MCP 服务器 URL
 *   - enabled: 是否启用
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** MCP 服务器配置 */
export interface McpServerEntry {
  id: string
  name: string
  type: string
  url: string
  enabled: boolean
}

/** MCP 服务器配置集合 */
export interface McpServersConfig {
  servers: McpServerEntry[]
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

/** 保存 MCP 服务器配置 */
export function saveMcpServers(servers: McpServerEntry[]): void {
  const path = configPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ servers }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
}

/** 获取启用的 MCP 服务器 */
export function getEnabledMcpServers(): McpServerEntry[] {
  return loadMcpServers().filter(s => s.enabled)
}

/** 生成唯一 ID */
function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 添加 MCP 服务器 */
export function addMcpServer(entry: Omit<McpServerEntry, 'id'>): McpServerEntry {
  const servers = loadMcpServers()
  const newEntry: McpServerEntry = { ...entry, id: generateId() }
  servers.push(newEntry)
  saveMcpServers(servers)
  return newEntry
}

/** 更新 MCP 服务器 */
export function updateMcpServer(id: string, updates: Partial<Omit<McpServerEntry, 'id'>>): boolean {
  const servers = loadMcpServers()
  const index = servers.findIndex(s => s.id === id)
  if (index === -1) return false
  servers[index] = { ...servers[index], ...updates }
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