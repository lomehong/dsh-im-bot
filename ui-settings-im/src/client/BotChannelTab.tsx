/**
 * Mobile Connect tab content: platform cards in one row, each with its brand
 * mark. Selecting a card starts a QR login via the im-channel host routes;
 * the detail area below splits into the QR (left) and the
 * platform-specific operation steps (right).
 *
 * The bindings list polls every 10s while the tab is visible and pauses on
 * `visibilitychange:hidden` so a backgrounded browser tab doesn't keep
 * hammering the host routes.
 */

import { useEffect, useRef, useState } from 'react'
import type { Kind } from './store.ts'
import { FeishuMark, WechatMark, WecomMark } from './platform-marks.tsx'
import css from './BotChannelTab.module.css'
import { QrPanel, type LoginStatus } from './QrPanel.tsx'
import { StepsPanel } from './StepsPanel.tsx'
import { PassphraseCard } from './PassphraseCard.tsx'
import { WecomConfigPanel } from './WecomConfigPanel.tsx'
import { McpServersPanel } from './McpServersPanel.tsx'
import { GuestPermissionsPanel } from './GuestPermissionsPanel.tsx'
import { BindingsTable, type BindingRow } from './BindingsTable.tsx'

export type { LoginStatus, BindingRow }

/** Injected dependencies (slot `inject`). */
export interface BotChannelTabInjected {
  t: (key: string) => string
}

/** Props delivered by the slot outlet. */
export type BotChannelTabProps = Partial<BotChannelTabInjected>

const POLL_INTERVAL_MS = 1500
const BINDINGS_POLL_INTERVAL_MS = 10_000

const CARD_MARKS = {
  wechat: WechatMark,
  feishu: FeishuMark,
  wecom: WecomMark,
} as const

export function BotChannelTab(props: BotChannelTabProps) {
  const t = props.t
  if (t === undefined) return null
  const [selected, setSelected] = useState<Kind | undefined>(undefined)
  const [login, setLogin] = useState<LoginStatus | undefined>(undefined)
  const [startError, setStartError] = useState<string | undefined>(undefined)
  const [bindings, setBindings] = useState<BindingRow[]>([])
  const [active, setActive] = useState<boolean>(typeof document === 'undefined' || !document.hidden)
  const loginPollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const bindingsPollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const refreshBindings = async (): Promise<void> => {
    try {
      const response = await fetch('/im-channel/bindings')
      const body = await response.json() as { ok: boolean; bindings: BindingRow[] }
      if (body.ok) {
        setBindings(body.bindings)
      }
    } catch {
      // Transient fetch failure: keep the last list.
    }
  }

  const removeBinding = async (row: BindingRow): Promise<void> => {
    try {
      await fetch('/im-channel/bindings/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: row.sessionId }),
      })
      await refreshBindings()
    } catch {
      // Keep the list as-is on transient failure.
    }
  }

  /** Start the bindings poll loop; idempotent — clears any existing one first. */
  const startBindingsPolling = (): void => {
    if (bindingsPollTimer.current !== undefined) return
    bindingsPollTimer.current = setInterval(() => { void refreshBindings() }, BINDINGS_POLL_INTERVAL_MS)
  }

  const stopBindingsPolling = (): void => {
    if (bindingsPollTimer.current === undefined) return
    clearInterval(bindingsPollTimer.current)
    bindingsPollTimer.current = undefined
  }

  useEffect(() => {
    // Bindings load on tab open (list + per-card counts), and the WeChat card
    // is pre-selected so its QR is already up when the tab opens.
    void refreshBindings()
    selectCard('wechat')
    startBindingsPolling()
    // Pause the bindings poll while the tab is backgrounded: a hidden page
    // keeps polling anyway and that wastes a round-trip per minute for no UX
    // benefit. visibilitychange is the spec'd signal.
    const onVisibility = (): void => {
      const visible = !document.hidden
      setActive(visible)
      if (visible) {
        void refreshBindings()
        startBindingsPolling()
      } else {
        stopBindingsPolling()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopBindingsPolling()
      if (loginPollTimer.current !== undefined) clearInterval(loginPollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopLoginPolling = (): void => {
    if (loginPollTimer.current === undefined) return
    clearInterval(loginPollTimer.current)
    loginPollTimer.current = undefined
  }

  const selectCard = (kind: Kind): void => {
    stopLoginPolling()
    setSelected(kind)
    setLogin(undefined)
    setStartError(undefined)
    void startLogin(kind)
  }

  const startLogin = async (kind: Kind): Promise<void> => {
    try {
      const response = await fetch('/im-channel/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const body = await response.json() as { ok: boolean; qrUrl?: string; error?: string }
      if (!body.ok) {
        setStartError(body.error ?? 'login start failed')
        return
      }
      if (body.qrUrl !== undefined) {
        setLogin({ kind, status: 'pending', qrUrl: body.qrUrl, error: undefined })
      }
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
      return
    }
    loginPollTimer.current = setInterval(() => { void pollStatus() }, POLL_INTERVAL_MS)
  }

  // Re-trigger a fresh login for the currently selected platform: retire the
  // old poll loop, drop back to the loading state, and fetch a new QR.
  const refreshQr = (): void => {
    if (selected === undefined) return
    stopLoginPolling()
    setStartError(undefined)
    setLogin({ kind: selected, status: 'pending', qrUrl: undefined, error: undefined })
    void startLogin(selected)
  }

  const pollStatus = async (): Promise<void> => {
    try {
      const response = await fetch('/im-channel/login/status')
      const body = await response.json() as { ok: boolean; session: LoginStatus | null }
      if (!body.ok || body.session === null) return
      setLogin(body.session)
      if (body.session.status === 'confirmed') {
        stopLoginPolling()
        // Scan confirmed: the bind command card appears right after a
        // successful login.
        void refreshBindings()
      }
      if (body.session.status === 'error') {
        stopLoginPolling()
      }
    } catch {
      // Transient fetch failure: keep polling; the TTL on the host side ends it.
    }
  }

  const cards: Array<{ kind: Kind; label: string }> = [
    { kind: 'wechat', label: t('card.wechat') },
    { kind: 'feishu', label: t('card.feishu') },
    { kind: 'wecom', label: t('card.wecom') },
  ]

  return (
    <div className={css.section}>
      <p className={css.intro}>{t('intro')}</p>
      <div role="radiogroup" aria-label={t('cards')} className={css.cards}>
        {cards.map(({ kind, label }) => {
          const Mark = CARD_MARKS[kind]
          const kindCount = bindings.filter(b => b.kind === kind).length
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected === kind}
              data-selected={selected === kind ? 'true' : undefined}
              className={css.card}
              onClick={() => selectCard(kind)}
            >
              <span className={css.cardIcon}><Mark /></span>
              <span className={css.cardName}>{label}</span>
              <span className={css.cardCount} data-has={kindCount > 0 ? 'true' : undefined}>{kindCount}</span>
            </button>
          )
        })}
      </div>

      {selected !== undefined && (
        <div className={css.detail}>
          {selected === 'wecom' ? (
            <WecomConfigPanel
              t={t}
              onConfigured={() => setLogin({ kind: 'wecom', status: 'confirmed', qrUrl: undefined, error: undefined })}
              onError={(msg) => setStartError(msg)}
            />
          ) : (
            <QrPanel login={login} startError={startError} t={t} onRefresh={refreshQr} />
          )}
          <StepsPanel kind={selected} t={t} />
        </div>
      )}
      {login?.status === 'confirmed' && <PassphraseCard t={t} />}

      <BindingsTable
        bindings={bindings}
        t={t}
        onRemove={row => { void removeBinding(row) }}
        onTest={row => {
          void (async () => {
            try {
              const resp = await fetch('/im-channel/test-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: row.kind }),
              })
              const data = await resp.json() as { ok: boolean; error?: string }
              setStartError(data.ok ? '' : (data.error ?? '发送失败'))
            } catch (err) {
              setStartError(err instanceof Error ? err.message : String(err))
            }
          })()
        }}
      />
      {!active && <p className={css.bindingsEmpty}>{t('bindings.paused')}</p>}
      <McpServersPanel />
      <GuestPermissionsPanel />
    </div>
  )
}