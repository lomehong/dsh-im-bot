/**
 * WeCom bot configuration panel: BotID + Secret form (replaces the QR flow for
 * WeCom, which uses long-connection credentials instead of scan-to-login).
 * MCP server configuration is handled by the general McpServersPanel component.
 */
import css from './BotChannelTab.module.css'

export interface WecomConfigPanelProps {
  t: (key: string) => string
  onConfigured: () => void
  onError: (msg: string) => void
}

const formFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  marginBottom: '16px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxSizing: 'border-box',
}

const submitButtonStyle: React.CSSProperties = {
  padding: '8px 24px',
  backgroundColor: '#2A9D8F',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
}

export function WecomConfigPanel({ onConfigured, onError }: WecomConfigPanelProps) {
  const submitBotConfig = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const form = e.currentTarget
    const botId = (form.elements.namedItem('botId') as HTMLInputElement).value.trim()
    const secret = (form.elements.namedItem('secret') as HTMLInputElement).value.trim()
    if (!botId || !secret) return
    try {
      const resp = await fetch('/im-channel/wecom/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, secret }),
      })
      const data = await resp.json() as { ok: boolean; error?: string }
      if (data.ok) {
        onConfigured()
      } else {
        onError(data.error ?? '配置失败')
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className={css.qrPanel}>
      <div style={{ padding: '16px', width: '100%' }}>
        <form onSubmit={(e) => { void submitBotConfig(e) }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>BotID</label>
          <input type="text" name="botId" placeholder="AIBOTID_xxxxxxxx" style={formFieldStyle} />
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Secret</label>
          <input type="password" name="secret" placeholder="输入 Secret" style={formFieldStyle} />
          <button type="submit" style={submitButtonStyle}>保存配置</button>
        </form>
      </div>
    </div>
  )
}