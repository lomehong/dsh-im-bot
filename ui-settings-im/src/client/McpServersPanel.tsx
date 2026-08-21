/**
 * MCP Server management panel: paste-to-import, connection testing, and
 * list management (toggle / edit / remove) for MCP servers.
 * These servers provide external tool capabilities (todo, schedule, meeting, etc.)
 * to the AI assistant through the Model Context Protocol.
 *
 * 添加体验以「粘贴」为中心：
 *   - 粘贴裸 URL（一行一个）或标准 mcpServers JSON（Claude Code / Cursor 格式）
 *   - 粘贴后自动解析并逐个测试连接，保存前即可看到可用工具数
 *   - 名称可省略：自动取自 JSON 键名或 URL 主机名
 */
import { useState, useEffect, useCallback } from 'react'

interface McpServerEntry {
  id: string
  name: string
  type: string
  url: string
  enabled: boolean
}

/** 单个候选服务器的连接测试状态 */
type TestState =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'ok', toolCount: number }
  | { state: 'fail', error: string }

/** 解析出的待导入候选 */
interface ImportCandidateUI {
  name: string
  url: string
  selected: boolean
  test: TestState
}

interface UnsupportedUI {
  name: string
  rawType: string
  reason: string
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

  /** 对一个 URL 发起连接测试，返回结果；不抛错。 */
  const runTest = async (url: string): Promise<TestState> => {
    try {
      const resp = await fetch('/im-channel/mcp-servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
        candidates?: Array<{ name: string, url: string }>
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
        setStatus({ kind: 'error', text: '没有识别出 MCP 服务器：支持 http(s) 地址（每行一个）或 mcpServers JSON 配置' })
        return
      }
      const initial: ImportCandidateUI[] = parsed.map(c => ({ name: c.name, url: c.url, selected: true, test: { state: 'idle' } }))
      setCandidates(initial)
      setUnsupported(unsup)
      setInvalidLines(bad)
      // 自动并发测试所有候选
      initial.forEach((c, index) => {
        setCandidates(prev => prev.map((item, i) => i === index ? { ...item, test: { state: 'testing' } } : item))
        void runTest(c.url).then(result => {
          setCandidates(prev => prev.map((item, i) => i === index ? { ...item, test: result } : item))
        })
      })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setParsing(false)
    }
  }

  /** 把勾选的候选逐个保存；重复 URL 视为跳过而非失败。 */
  const addSelected = async (): Promise<void> => {
    const chosen = candidates.filter(c => c.selected)
    if (chosen.length === 0) return
    setImporting(true)
    let added = 0
    let skipped = 0
    const failures: string[] = []
    for (const c of chosen) {
      try {
        const resp = await fetch('/im-channel/mcp-servers/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: c.name.trim() === '' ? undefined : c.name.trim(), type: 'streamable-http', url: c.url }),
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
    const result = await runTest(server.url)
    setRowTests(prev => ({ ...prev, [server.id]: result }))
  }

  const startEdit = (server: McpServerEntry): void => {
    setEditingId(server.id)
    setEditName(server.name)
    setEditUrl(server.url)
    setConfirmDeleteId(undefined)
  }

  const saveEdit = async (): Promise<void> => {
    if (editingId === undefined) return
    if (editName.trim() === '' || editUrl.trim() === '') {
      setStatus({ kind: 'error', text: '名称和 URL 不能为空' })
      return
    }
    try {
      const resp = await fetch('/im-channel/mcp-servers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: editName.trim(), url: editUrl.trim() }),
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
          placeholder={'粘贴 MCP 服务器地址（每行一个），或标准 mcpServers JSON 配置，例如：\nhttps://mcp.example.com/mcp\n{"mcpServers": { "待办": { "url": "https://…" } }}'}
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
        <span style={{ fontSize: '11px', color: '#aaa' }}>支持 Claude Code / Cursor 的 mcpServers JSON 格式与裸 URL</span>
      </div>

      {/* 解析预览 */}
      {candidates.length > 0 && (
        <div style={{ border: '1px solid #E5E5E5', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', backgroundColor: '#FAFAFA' }}>
          <div style={{ fontSize: '12px', color: '#666', margin: '4px 0 8px' }}>
            识别出 {candidates.length} 个服务器（已自动测试连接，可修改名称）
          </div>
          {candidates.map((c, index) => (
            <div key={c.url} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '13px' }}>
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
              <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.url}>{c.url}</span>
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
        <p style={{ color: '#999', fontSize: '13px', marginBottom: '12px' }}>暂无 MCP 服务器——在上方粘贴一个 MCP 服务器地址试试</p>
      )}
      {servers.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderBottom: '1px solid #eee', fontSize: '13px', flexWrap: 'wrap' }}>
          {editingId === s.id ? (
            <>
              <input value={editName} aria-label="名称" onChange={e => setEditName(e.target.value)} style={{ flex: '0 0 140px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <input value={editUrl} aria-label="URL" onChange={e => setEditUrl(e.target.value)} style={{ flex: 2, minWidth: '200px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              <button style={smallBtn} onClick={() => { void saveEdit() }}>保存</button>
              <button style={ghostBtn} onClick={() => setEditingId(undefined)}>取消</button>
            </>
          ) : (
            <>
              <span
                title={s.enabled ? '点击停用' : '点击启用'}
                style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                onClick={() => { void toggleServer(s) }}
              >
                {s.enabled ? '✅' : '⭕'}
              </span>
              <span style={{ flex: '0 0 120px', fontWeight: '500' }}>{s.name}</span>
              <span style={{ flex: 1, color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.url}>{s.url}</span>
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
            </>
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
