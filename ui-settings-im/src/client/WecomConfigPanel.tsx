/**
 * WeCom bot configuration panel. QR-first: scanning with the WeCom app
 * CREATES an intelligent bot on the user's account and hands back its
 * credentials automatically (quick-create service). The BotID + Secret form
 * stays as a collapsed fallback for manual credentials.
 * MCP server configuration is handled by the general McpServersPanel component.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
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

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#2A9D8F',
  cursor: 'pointer',
  padding: '4px 0',
  textDecoration: 'underline',
  fontSize: '13px',
}

interface QrStartPayload { ok: boolean; qrUrl?: string; scode?: string; pollIntervalMs?: number; error?: string }
interface QrStatusPayload { ok: boolean; status?: 'waiting' | 'confirmed' | 'expired' | 'failed'; error?: string }

export function WecomConfigPanel({ onConfigured, onError }: WecomConfigPanelProps) {
  const [qrUrl, setQrUrl] = useState<string | undefined>(undefined)
  const [polling, setPolling] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const scodeRef = useRef<string | undefined>(undefined)
  const timerRef = useRef<number | undefined>(undefined)

  const stopPolling = useCallback((): void => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
    setPolling(false)
  }, [])

  const startQr = useCallback(async (): Promise<void> => {
    stopPolling()
    try {
      const resp = await fetch('/im-channel/wecom/qr/start')
      const data = await resp.json() as QrStartPayload & { qrUrl?: string }
      if (!data.ok || data.qrUrl === undefined) {
        onError(`扫码服务不可用：${data.error ?? '未知错误'}。可使用下方手动配置。`)
        setShowManual(true)
        return
      }
      scodeRef.current = data.scode
      setQrUrl(data.qrUrl)
      setPolling(true)
      const interval = Math.max(2000, data.pollIntervalMs ?? 3000)
      timerRef.current = window.setInterval(() => { void pollQr() }, interval)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling])

  const pollQr = useCallback(async (): Promise<void> => {
    const scode = scodeRef.current
    if (scode === undefined) return
    try {
      const resp = await fetch(`/im-channel/wecom/qr/status?scode=${encodeURIComponent(scode)}`)
      const data = await resp.json() as QrStatusPayload
      if (data.ok && data.status === 'confirmed') {
        stopPolling()
        onConfigured()
        return
      }
      if (data.ok && (data.status === 'expired' || data.status === 'failed')) {
        stopPolling()
        onError('扫码已过期或失败，请点击二维码重试，或使用手动配置。')
      }
    } catch {
      // 网络抖动：下一轮轮询继续。
    }
  }, [stopPolling, onConfigured])

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current)
    }
  }, [])

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
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#666' }}>
          用企业微信 App 扫码，一键创建智能机器人并自动完成配置。
        </p>
        {qrUrl !== undefined && (
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}`}
              alt="企业微信扫码创建机器人"
              style={{ width: 240, height: 240, cursor: 'pointer' }}
              onClick={() => { void startQr() }}
            />
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: polling ? '#2A9D8F' : '#999' }}>
              {polling ? '等待扫码确认…（点击二维码刷新）' : '点击二维码重新生成'}
            </p>
          </div>
        )}
        {qrUrl === undefined && (
          <button type="button" style={submitButtonStyle} onClick={() => { void startQr() }}>
            生成扫码二维码
          </button>
        )}
        <button type="button" style={{ ...linkStyle, display: 'block', margin: '8px 0' }} onClick={() => { setShowManual(v => !v) }}>
          {showManual ? '收起手动配置' : '已有机器人？手动填写 BotID / Secret'}
        </button>
        {showManual && (
          <form onSubmit={(e) => { void submitBotConfig(e) }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>BotID</label>
            <input type="text" name="botId" placeholder="AIBOTID_xxxxxxxx" style={formFieldStyle} />
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Secret</label>
            <input type="password" name="secret" placeholder="输入 Secret" style={formFieldStyle} />
            <button type="submit" style={submitButtonStyle}>保存配置</button>
          </form>
        )}
      </div>
    </div>
  )
}
