/**
 * MCP Server management panel: paste-to-import, connection testing, and
 * list management (toggle / edit / remove) for MCP servers.
 * These servers provide external tool capabilities (todo, schedule, meeting, etc.)
 * to the AI assistant through the Model Context Protocol.
 *
 * 支持两种标准传输：
 *   - streamable-http：url + 可选请求头（如鉴权 token）
 *   - stdio：command + args（本地进程，来自 mcpServers JSON 粘贴）
 *
 * 添加体验以「粘贴」为中心：
 *   - 粘贴裸 URL（一行一个）或标准 mcpServers JSON（Claude Code / Cursor 格式）
 *   - 粘贴后自动解析并逐个测试连接，保存前即可看到可用工具数
 *   - 名称可省略：自动取自 JSON 键名、URL 主机名或命令名
 */
import { useState, useEffect, useCallback } from 'react'

interface McpServerEntry {
  id: string
  name: string
  type: string
  url: string
  enabled: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

/** 单个候选服务器的连接测试状态 */
type TestState =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'ok', toolCount: number }
  | { state: 'fail', error: string }

/** 解析出的待导入候选（HTTP 与 stdio 通用） */
interface ImportCandidateUI {
  name: string
  url: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
  selected: boolean
  test: TestState
}

interface UnsupportedUI {
  name: string
  rawType: string
  reason: string
}

/** 连接测试请求目标 */
interface TestTarget {
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
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
const ghostBtn: React.CSSProperties = { ...smallBtn, backgroundColor: '#fff', color: '#555', border: '1px solid #ccc' }

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '10px',
  fontSize: '11px',
  whiteSpace: 'nowrap',
}

const typeBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  backgroundColor: '#F0F0F0',
  color: '#777',
  flex: 'none',
}

/** 展示用：HTTP 显示 url，stdio 显示命令行 */
function formatTarget(entry: { url: string, command?: string, args?: string[] }): string {
  if (entry.url !== '') return entry.url
  const args = entry.args ?? []
  return args.length > 0 ? `${entry.command ?? ''} ${args.join(' ')}` : (entry.command ?? '')
}

/** headers 文本（每行 Key: Value）⇄ 对象互转 */
function parseHeadersText(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const idx = trimmed.indexOf(':')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (key !== '') out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function headersToText(headers: Record<string, string> | undefined): string {
  if (headers === undefined) return ''
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n')
}

/** 连接测试徽章 */
function TestBadge({ test }: { test: TestState }): React.ReactElement {
  if (test.state === 'idle') return <span />
  if (test.state === 'testing') {
    return <span style={{ ...badgeStyle, backgroundColor: '#F4F4F4', color: '#888' }}>⏳ 测试中…</span>
  }
  if (test.state === 'ok') {
    return <span style={{ ...badgeStyle, backgroundColor: '#E4F5F2', color: '#2A9D8F' }}>✅ {test.toolCount} 个工具</span>
  }
  return (
    <span title={test.error} style={{ ...badgeStyle, backgroundColor: '#FDEEE8', color: '#E76F51', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      ❌ {test.error}
    </span>
  )
}

export function McpServersPanel() {
  const [servers, setServers] = useState<McpServerEntry[]>([])
  const [status, setStatus] = useState<{ kind: 'ok' | 'error', text: string } | undefined>(undefined)

  // 快速添加（粘贴导入）
  const [importText, setImportText] = useState('')
  const [candidates, setCandidates] = useState<ImportCandidateUI[]>([])
  const [unsupported, setUnsupported] = useState<UnsupportedUI[]>([])
  const [invalidLines, setInvalidLines] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  // 列表行：连接测试 / 编辑 / 删除确认
  const [rowTests, setRowTests] = useState<Record<string, TestState>>({})
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editHeaders, setEditHeaders] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | undefined>(undefined)

  const loadServers = useCallback((): void => {
    fetch('/im-channel/mcp-servers')
      .then(r => r.json())
      .then((data: { ok: boolean; servers: McpServerEntry[] }) => {
        if (data.ok) setServers(data.servers)
      })
      .catch(() => {})
  }, [])

  useEffect(loadServers, [loadServers])

  /** 对一个目标（HTTP url 或 stdio command）发起连接测试，返回结果；不抛错。 */
  const runTest = async (target: TestTarget): Promise<TestState> => {
    try {
      const resp = await fetch('/im-channel/mcp-servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      })
      const data = await resp.json() as { ok: boolean, result?: { ok: boolean, toolCount?: number, error?: string }, error?: string }
      if (data.ok && data.result?.ok === true) {
        return { state: 'ok', toolCount: data.result.toolCount ?? 0 }
      }
      return { state: 'fail', error: data.result?.error ?? data.error ?? '测试失败' }
    } catch (err) {
      return { state: 'fail', error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 候选的测试目标（只带各自传输所需字段） */
  const testTargetOf = (c: { url: string, command?: string, args?: string[], env?: Record<string, string>, headers?: Record<string, string> }): TestTarget => {
    if (c.command !== undefined) {
      return {
        command: c.command,
        ...(c.args !== undefined ? { args: c.args } : {}),
        ...(c.env !== undefined ? { env: c.env } : {}),
      }
    }
    return {
      url: c.url,
      ...(c.headers !== undefined ? { headers: c.headers } : {}),
    }
  }

  /** 解析粘贴内容并自动逐个测试连接。silent=true 时无有效内容则不打扰；textOverride 用于粘贴事件（闭包中的 importText 尚未更新）。 */
  const parseInput = async (silent: boolean, textOverride?: string): Promise<void> => {
    const text = (textOverride ?? importText).trim()
    if (text === '') {
      if (!silent) setStatus({ kind: 'error', text: '请先粘贴 MCP 服务器地址或配置' })
      return
    }
    setParsing(true)
    try {
      const resp = await fetch('/im-channel/mcp-servers/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await resp.json() as {
        ok: boolean
        candidates?: Array<{ name: string, url: string, command?: string, args?: string[], env?: Record<string, string>, headers?: Record<string, string> }>
        unsupported?: Array<{ name: string, rawType: string, reason: string }>
        invalid?: string[]
        error?: string
      }
      if (!data.ok) {
        setStatus({ kind: 'error', text: data.error ?? '解析失败' })
        return
      }
      const parsed = data.candidates ?? []
      const bad = data.invalid ?? []
      const unsup = data.unsupported ?? []
      if (silent && parsed.length === 0 && bad.length === 0 && unsup.length === 0) return
      if (parsed.length === 0 && bad.length === 0 && unsup.length === 0) {
        setStatus({ kind: 'error', text: '没有识别出 MCP 服务器：支持 http(s) 地址（每行一个）或 mcpServers JSON 配置（含 stdio）' })
        return
      }
      const initial: ImportCandidateUI[] = parsed.map(c => ({
        name: c.name,
        url: c.url,
        ...(c.command !== undefined ? { command: c.command } : {}),
        ...(c.args !== undefined ? { args: c.args } : {}),
        ...(c.env !== undefined ? { env: c.env } : {}),
        ...(c.headers !== undefined ? { headers: c.headers } : {}),
        selected: true,
        test: { state: 'idle' },
      }))
      setCandidates(initial)
      setUnsupported(unsup)
      setInvalidLines(bad)
      // 自动并发测试所有候选
      initial.forEach((c, index) => {
        setCandidates(prev => prev.map((item, i) => i === index ? { ...item, test: { state: 'testing' } } : item))
        void runTest(testTargetOf(c)).then(result => {
          setCandidates(prev => prev.map((item, i) => i === index ? { ...item, test: result } : item))
        })
      })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setParsing(false)
    }
  }

  /** 把勾选的候选逐个保存；重复视为跳过而非失败。 */
  const addSelected = async (): Promise<void> => {
    const chosen = candidates.filter(c => c.selected)
    if (chosen.length === 0) return
    setImporting(true)
    let added = 0
    let skipped = 0
    const failures: string[] = []
    for (const c of chosen) {
      try {
        const body = c.command !== undefined
          ? {
              name: c.name.trim() === '' ? undefined : c.name.trim(),
              command: c.command,
              ...(c.args !== undefined ? { args: c.args } : {}),
              ...(c.env !== undefined ? { env: c.env } : {}),
            }
          : {
              name: c.name.trim() === '' ? undefined : c.name.trim(),
              type: 'streamable-http',
              url: c.url,
              ...(c.headers !== undefined ? { headers: c.headers } : {}),
            }
        const resp = await fetch('/im-channel/mcp-servers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await resp.json() as { ok: boolean, error?: string, code?: string }
        if (data.ok) added++
        else if (data.code === 'duplicate') skipped++
        else failures.push(`${c.name}: ${data.error ?? '添加失败'}`)
      } catch (err) {
        failures.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    setImporting(false)
    if (added > 0 || skipped > 0) {
      setImportText('')
      setCandidates([])
      setUnsupported([])
      setInvalidLines([])
    }
    const parts: string[] = []
    if (added > 0) parts.push(`已添加 ${added} 个`)
    if (skipped > 0) parts.push(`跳过重复 ${skipped} 个`)
    if (failures.length > 0) parts.push(`失败 ${failures.length} 个（${failures[0]}）`)
    if (parts.length > 0) setStatus({ kind: failures.length > 0 && added === 0 ? 'error' : 'ok', text: parts.join('，') })
    loadServers()
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
        setStatus({ kind: 'ok', text: '已删除' })
        setConfirmDeleteId(undefined)
        loadServers()
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
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
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  /** 测试列表中某个已保存服务器的连接。 */
  const testRow = async (server: McpServerEntry): Promise<void> => {
    setRowTests(prev => ({ ...prev, [server.id]: { state: 'testing' } }))
    const result = await runTest(testTargetOf(server))
    setRowTests(prev => ({ ...prev, [server.id]: result }))
  }

  const startEdit = (server: McpServerEntry): void => {
    setEditingId(server.id)
    setEditName(server.name)
    setEditUrl(server.url)
    setEditHeaders(headersToText(server.headers))
    setConfirmDeleteId(undefined)
  }

  const editingServer = servers.find(s => s.id === editingId)
  const editingStdio = editingServer !== undefined && editingServer.url === ''

  const saveEdit = async (): Promise<void> => {
    if (editingId === undefined) return
    if (editName.trim() === '') {
      setStatus({ kind: 'error', text: '名称不能为空' })
      return
    }
    if (!editingStdio && editUrl.trim() === '') {
      setStatus({ kind: 'error', text: 'URL 不能为空' })
      return
    }
    try {
      const body = editingStdio
        ? { id: editingId, name: editName.trim() }
        : {
            id: editingId,
            name: editName.trim(),
            url: editUrl.trim(),
            // 空文本 → {}，后端据此清空已有 headers
            headers: parseHeadersText(editHeaders) ?? {},
          }
      const resp = await fetch('/im-channel/mcp-servers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await resp.json() as { ok: boolean, error?: string }
      if (data.ok) {
        setEditingId(undefined)
        setStatus({ kind: 'ok', text: '已保存' })
        loadServers()
      } else {
        setStatus({ kind: 'error', text: data.error ?? '保存失败' })
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  const selectedCount = candidates.filter(c => c.selected).length

  return (
    <div style={{ marginTop: '24px', padding: '16px', borderTop: '1px solid #ddd' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>MCP 服务器管理</h3>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
        配置 MCP 服务器，为 AI 助手提供日程、待办、会议等外部工具能力。直接粘贴地址即可添加，保存前自动测试连接。
      </p>

      {/* 快速添加：粘贴即解析 */}
      <div style={{ marginBottom: '8px' }}>
        <textarea
          placeholder={'粘贴 MCP 服务器地址（每行一个），或标准 mcpServers JSON 配置（HTTP / stdio 均可），例如：\nhttps://mcp.example.com/mcp\n{"mcpServers": { "待办": { "url": "https://…" }, "本地": { "command": "npx", "args": ["-y", "some-server"] } }}'}
          value={importText}
          onChange={e => setImportText(e.target.value)}
          onPaste={e => {
            const pasted = e.clipboardData.getData('text')
            if (pasted.trim() !== '') setTimeout(() => { void parseInput(true, pasted) }, 50)
          }}
          style={{ ...formFieldStyle, fontFamily: 'inherit', resize: 'vertical', minHeight: '64px' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <button style={btnStyle} disabled={parsing || importText.trim() === ''} onClick={() => { void parseInput(false) }}>
          {parsing ? '解析中…' : '解析并预览'}
        </button>
        {importText !== '' && candidates.length === 0 && (
          <button style={ghostBtn} onClick={() => setImportText('')}>清空</button>
        )}
        <span style={{ fontSize: '11px', color: '#aaa' }}>支持 Claude Code / Cursor 的 mcpServers JSON（HTTP 与 stdio）与裸 URL</span>
      </div>

      {/* 解析预览 */}
      {candidates.length > 0 && (
        <div style={{ border: '1px solid #E5E5E5', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', backgroundColor: '#FAFAFA' }}>
          <div style={{ fontSize: '12px', color: '#666', margin: '4px 0 8px' }}>
            识别出 {candidates.length} 个服务器（已自动测试连接，可修改名称）
          </div>
          {candidates.map((c, index) => (
            <div key={formatTarget(c)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={c.selected}
                aria-label={`选择 ${c.name}`}
                onChange={e => setCandidates(prev => prev.map((item, i) => i === index ? { ...item, selected: e.target.checked } : item))}
              />
              <input
                value={c.name}
                aria-label="服务器名称"
                onChange={e => setCandidates(prev => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                style={{ flex: '0 0 150px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <span style={typeBadgeStyle}>{c.command !== undefined ? 'stdio' : 'HTTP'}</span>
              <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatTarget(c)}>{formatTarget(c)}</span>
              <TestBadge test={c.test} />
            </div>
          ))}
          {unsupported.map(u => (
            <div key={u.name} style={{ display: 'flex', gap: '8px', padding: '6px 0', fontSize: '12px', color: '#B7791F' }}>
              <span>⚠️ {u.name}（{u.rawType}）</span>
              <span style={{ flex: 1 }}>{u.reason}</span>
            </div>
          ))}
          {invalidLines.map((line, i) => (
            <div key={`${i}-${line.slice(0, 20)}`} style={{ padding: '4px 0', fontSize: '12px', color: '#E76F51' }}>
              ✗ 无法识别：{line}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button style={btnStyle} disabled={importing || selectedCount === 0} onClick={() => { void addSelected() }}>
              {importing ? '添加中…' : `添加所选（${selectedCount}）`}
            </button>
            <button style={ghostBtn} disabled={importing} onClick={() => { setCandidates([]); setUnsupported([]); setInvalidLines([]) }}>取消</button>
          </div>
        </div>
      )}

      {/* 已有服务器列表 */}
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '4px' }}>
        已有服务器（{servers.length}）
      </div>
      {servers.length === 0 && (
        <p style={{ color: '#999', fontSize: '13px', marginBottom: '12px' }}>暂无 MCP 服务器——在上方粘贴一个 MCP 服务器地址或 mcpServers JSON 试试</p>
      )}
      {servers.map(s => (
        <div key={s.id} style={{ padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
          {editingId === s.id ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input value={editName} aria-label="名称" onChange={e => setEditName(e.target.value)} style={{ flex: '0 0 140px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                <span style={typeBadgeStyle}>{editingStdio ? 'stdio' : 'HTTP'}</span>
                {editingStdio ? (
                  <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatTarget(s)}>
                    {formatTarget(s)}（如需修改命令请删除后重新导入）
                  </span>
                ) : (
                  <input value={editUrl} aria-label="URL" onChange={e => setEditUrl(e.target.value)} style={{ flex: 2, minWidth: '200px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                )}
                <button style={smallBtn} onClick={() => { void saveEdit() }}>保存</button>
                <button style={ghostBtn} onClick={() => setEditingId(undefined)}>取消</button>
              </div>
              {!editingStdio && (
                <textarea
                  value={editHeaders}
                  aria-label="请求头"
                  onChange={e => setEditHeaders(e.target.value)}
                  placeholder={'附加请求头（可选，每行一个 Key: Value），例如：\nAuthorization: Bearer …'}
                  style={{ ...formFieldStyle, marginTop: '8px', marginBottom: 0, fontFamily: 'inherit', resize: 'vertical', minHeight: '40px', fontSize: '12px' }}
                />
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                title={s.enabled ? '点击停用' : '点击启用'}
                style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                onClick={() => { void toggleServer(s) }}
              >
                {s.enabled ? '✅' : '⭕'}
              </span>
              <span style={{ flex: '0 0 120px', fontWeight: '500' }}>{s.name}</span>
              <span style={typeBadgeStyle}>{s.url === '' ? 'stdio' : 'HTTP'}</span>
              <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatTarget(s)}>
                {formatTarget(s)}{s.headers !== undefined ? '　🔑' : ''}
              </span>
              <TestBadge test={rowTests[s.id] ?? { state: 'idle' }} />
              <button style={ghostBtn} onClick={() => { void testRow(s) }}>测试</button>
              <button style={ghostBtn} onClick={() => startEdit(s)}>编辑</button>
              {confirmDeleteId === s.id ? (
                <>
                  <button style={dangerBtn} onClick={() => { void removeServer(s.id) }}>确认删除</button>
                  <button style={ghostBtn} onClick={() => setConfirmDeleteId(undefined)}>取消</button>
                </>
              ) : (
                <button style={ghostBtn} onClick={() => setConfirmDeleteId(s.id)}>删除</button>
              )}
            </div>
          )}
        </div>
      ))}

      {status !== undefined && (
        <p role="alert" style={{ color: status.kind === 'ok' ? '#2A9D8F' : '#E76F51', fontSize: '12px', marginTop: '8px' }}>
          {status.kind === 'ok' ? '✅ ' : ''}{status.text}
        </p>
      )}
    </div>
  )
}
