/**
 * QR display panel: one of three states (waiting / pending with QR / confirmed /
 * error). The QR image itself is clickable to refresh the login session.
 */
import type { Kind } from './store.ts'
import { qrSvgDataUrl } from './qr.ts'
import css from './BotChannelTab.module.css'

export type LoginStatus = {
  kind: Kind
  status: 'pending' | 'confirmed' | 'error'
  qrUrl: string | undefined
  error: string | undefined
}

export interface QrPanelProps {
  login: LoginStatus | undefined
  startError: string | undefined
  /** Translator for the i18n keys the panel surfaces. */
  t: (key: string) => string
  onRefresh: () => void
}

export function QrPanel({ login, startError, t, onRefresh }: QrPanelProps) {
  return (
    <div className={css.qrPanel} data-state={login?.status ?? (startError !== undefined ? 'error' : 'pending')}>
      {startError !== undefined && <p role="alert" className={css.qrError}>{startError}</p>}
      {startError === undefined && login?.qrUrl === undefined && (
        <div className={css.qrSpinner}>
          <span className={css.qrSpinnerRing} />
          <span>{t('qr.waiting')}</span>
        </div>
      )}
      {login?.qrUrl !== undefined && (
        <div className={css.qrClickArea}>
          <button
            type="button"
            className={css.qrRefreshButton}
            onClick={onRefresh}
            aria-label={t('qr.refresh')}
            title={t('qr.refresh')}
          >
            <img
              className={css.qrImage}
              src={qrSvgDataUrl(login.qrUrl)}
              alt={t('qr.alt')}
              width={240}
              height={240}
            />
          </button>
          <span className={css.qrRefreshHint}>{t('qr.refreshHint')}</span>
        </div>
      )}
      {login?.status === 'confirmed' && <p className={css.qrOk}>{t('qr.confirmed')}</p>}
      {login?.status === 'error' && <p role="alert" className={css.qrError}>{login.error}</p>}
    </div>
  )
}