/**
 * Guest permissions panel (digital-avatar model): the channel owner configures
 * which tools and commands guests may use. Guests share the owner's session;
 * the tools guard denies anything not on this allowlist during guest turns.
 */
import { useCallback, useEffect, useState } from 'react'
import css from './BotChannelTab.module.css'

interface ToolCatalogEntry { pattern: string; label: string; risky: boolean }
interface CommandCatalogEntry { id: string; label: string }
interface PermissionsPayload {
  ok: boolean
  guestTools: string[]
  guestCommands: string[]
  toolCatalog: ToolCatalogEntry[]
  commandCatalog: CommandCatalogEntry[]
  owners: Record<string, { bound: boolean; userId: string }>
}

const KIND_LABELS: Record<string, string> = { wechat: '微信', feishu: '飞书', wecom: '企业微信' }

export function GuestPermissionsPanel(): React.ReactElement {
  const [data, setData] = useState<PermissionsPayload | undefined>(undefined)
  const [tools, setTools] = useState<string[]>([])
  const [commands, setCommands] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async (): Promise<void> => {
    try {
      const resp = await fetch('/im-channel/guest-permissions')
      const payload = await resp.json() as PermissionsPayload
      if (payload.ok) {
        setData(payload)
        setTools(payload.guestTools)
        setCommands(payload.guestCommands)
      } else {
        setMessage('读取访客权限失败')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value]

  const catalogPatterns = new Set((data?.toolCatalog ?? []).map(e => e.pattern))
  const customPatterns = tools.filter(t => !catalogPatterns.has(t))

  const addCustom = (): void => {
    const value = custom.trim()
    if (value.length === 0 || tools.includes(value)) return
    setTools([...tools, value])
    setCustom('')
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setMessage('')
    try {
      const resp = await fetch('/im-channel/guest-permissions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestTools: tools, guestCommands: commands }),
      })
      const payload = await resp.json() as { ok: boolean; error?: string }
      setMessage(payload.ok ? '✅ 已保存，下一轮对话即生效' : `保存失败：${payload.error ?? '未知错误'}`)
      if (payload.ok) await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (data === undefined) {
    return <div className={css.qrPanel}><div style={{ padding: '16px' }}>{message || '加载访客权限…'}</div></div>
  }

  const ownerLine = Object.entries(data.owners)
    .map(([kind, o]) => `${KIND_LABELS[kind] ?? kind}：${o.bound ? `已认领（${o.userId}）` : '未认领'}`)
    .join('　·　')

  return (
    <div className={css.qrPanel}>
      <div style={{ padding: '16px', width: '100%' }}>
        <h3 style={{ margin: '0 0 4px' }}>🛡 访客权限</h3>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>
          数字分身模式：只有 Owner 需要 /bind，其他所有人作为访客直接对话。
          访客共享 Owner 的会话上下文，但只能使用下方勾选的能力。保存后下一轮对话即生效。
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '13px' }}>{ownerLine}</p>

        <h4 style={{ margin: '0 0 8px' }}>访客可用命令</h4>
        <div style={{ marginBottom: '16px' }}>
          {(data.commandCatalog ?? []).map(entry => (
            <label key={entry.id} style={{ display: 'block', marginBottom: '4px' }}>
              <input
                type="checkbox"
                checked={commands.includes(entry.id)}
                onChange={() => { setCommands(toggle(commands, entry.id)) }}
              />
              <span style={{ marginLeft: '6px' }}>{entry.label}</span>
            </label>
          ))}
        </div>

        <h4 style={{ margin: '0 0 8px' }}>访客可用工具</h4>
        <div style={{ marginBottom: '8px' }}>
          {(data.toolCatalog ?? []).map(entry => (
            <label key={entry.pattern} style={{ display: 'block', marginBottom: '4px' }}>
              <input
                type="checkbox"
                checked={tools.includes(entry.pattern)}
                onChange={() => { setTools(toggle(tools, entry.pattern)) }}
              />
              <span style={{ marginLeft: '6px' }}>
                {entry.label}
                {entry.risky ? <span style={{ color: '#c0392b', marginLeft: '6px' }}>⚠ 高危</span> : null}
                <span style={{ color: '#999', marginLeft: '6px', fontFamily: 'monospace', fontSize: '12px' }}>{entry.pattern}</span>
              </span>
            </label>
          ))}
        </div>

        {customPatterns.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>自定义条目：</div>
            {customPatterns.map(pattern => (
              <div key={pattern} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <code style={{ fontFamily: 'monospace', fontSize: '12px' }}>{pattern}</code>
                <button type="button" onClick={() => { setTools(tools.filter(t => t !== pattern)) }} style={{ cursor: 'pointer' }}>移除</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={custom}
            placeholder="自定义工具名或通配（如 mcp__wecom*）"
            onChange={e => { setCustom(e.target.value) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            style={{ flex: 1, padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button type="button" onClick={addCustom} style={{ padding: '6px 12px', cursor: 'pointer' }}>添加</button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => { void save() }}
          style={{ padding: '8px 24px', backgroundColor: '#2A9D8F', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? '保存中…' : '保存访客权限'}
        </button>
        {message !== '' && <p style={{ margin: '10px 0 0', fontSize: '13px' }}>{message}</p>}
      </div>
    </div>
  )
}
