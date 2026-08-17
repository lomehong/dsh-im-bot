/**
 * MCP Server management panel: list, add, toggle, and remove MCP servers.
 * These servers provide external tool capabilities (todo, schedule, meeting, etc.)
 * to the AI assistant through the Model Context Protocol.
 */
import { useState, useEffect } from 'react'

interface McpServerEntry {
  id: string
  name: string
  type: string
  url: string
  enabled: boolean
}

const formFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  marginBottom: '12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px',
  backgroundColor: '#2A9D8F',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '13px',
}

const smallBtn: React.CSSProperties = { ...btnStyle, padding: '4px 10px', fontSize: '12px' }
const dangerBtn: React.CSSProperties = { ...smallBtn, backgroundColor: '#E76F51' }

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServerEntry[]>([])
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('streamable-http')
  const [newUrl, setNewUrl] = useState('')
  const [status, setStatus] = useState<string | undefined>(undefined)

  const loadServers = (): void => {
    fetch('/im-channel/mcp-servers')
      .then(r => r.json())
      .then((data: { ok: boolean; servers: McpServerEntry[] }) => {
        if (data.ok) setServers(data.servers)
      })
      .catch(() => {})
  }

  useEffect(loadServers, [])

  const addServer = async (): Promise<void> => {
    if (!newName.trim() || !newUrl.trim()) return
    try {
      const resp = await fetch('/im-channel/mcp-servers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType.trim(), url: newUrl.trim() }),
      })
      const data = await resp.json() as { ok: boolean; error?: string }
      if (data.ok) {
        setNewName('')
        setNewUrl('')
        setStatus('added')
        loadServers()
      } else {
        setStatus('error: ' + (data.error ?? '添加失败'))
      }
    } catch (err) {
      setStatus('error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const removeServer = async (id: string): Promise<void> => {
    try {
      const resp = await fetch('/im-channel/mcp-servers/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await resp.json() as { ok: boolean }
      if (data.ok) {
        setStatus('removed')
        loadServers()
      }
    } catch (err) {
      setStatus('error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const toggleServer = async (server: McpServerEntry): Promise<void> => {
    try {
      const resp = await fetch('/im-channel/mcp-servers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id, enabled: !server.enabled }),
      })
      const data = await resp.json() as { ok: boolean }
      if (data.ok) loadServers()
    } catch (err) {
      setStatus('error: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div style={{ marginTop: '24px', padding: '16px', borderTop: '1px solid #ddd' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>MCP 服务器管理</h3>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
        配置 MCP 服务器，为 AI 助手提供日程、待办、会议等外部工具能力。
      </p>

      {servers.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {servers.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
              <span
                style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                onClick={() => { void toggleServer(s) }}
              >
                {s.enabled ? '✅' : '⭕'}
              </span>
              <span style={{ flex: '0 0 120px', fontWeight: '500' }}>{s.name}</span>
              <span style={{ flex: '0 0 140px', color: '#888', fontSize: '12px' }}>{s.type}</span>
              <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</span>
              <button style={dangerBtn} onClick={() => { void removeServer(s.id) }}>删除</button>
            </div>
          ))}
        </div>
      )}

      {servers.length === 0 && (
        <p style={{ color: '#999', fontSize: '13px', marginBottom: '12px' }}>暂无 MCP 服务器配置</p>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <input placeholder="名称" value={newName} onChange={e => setNewName(e.target.value)} style={formFieldStyle} />
        </div>
        <div style={{ flex: '0 0 150px' }}>
          <select value={newType} onChange={e => setNewType(e.target.value)} style={formFieldStyle}>
            <option value="streamable-http">streamable-http</option>
            <option value="stdio">stdio</option>
          </select>
        </div>
        <div style={{ flex: '2 1 250px' }}>
          <input placeholder="URL（MCP 服务器地址）" value={newUrl} onChange={e => setNewUrl(e.target.value)} style={formFieldStyle} />
        </div>
        <button style={{ ...btnStyle, marginBottom: '12px' }} onClick={() => { void addServer() }}>添加服务器</button>
      </div>

      {status === 'added' && <p style={{ color: '#2A9D8F', fontSize: '12px', marginTop: '8px' }}>✅ MCP 服务器已添加</p>}
      {status === 'removed' && <p style={{ color: '#2A9D8F', fontSize: '12px', marginTop: '8px' }}>已删除</p>}
      {typeof status === 'string' && status.startsWith('error:') && (
        <p role="alert" style={{ color: '#E76F51', fontSize: '12px', marginTop: '8px' }}>{status.slice(6)}</p>
      )}
    </div>
  )
}