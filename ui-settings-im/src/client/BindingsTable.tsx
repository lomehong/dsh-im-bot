/**
 * Bindings table: list of IM-user-to-session rows with a remove button each.
 * Owns no fetching — the parent passes the rows + remove callback so the
 * polling lifecycle stays in one place.
 */
import type { Kind } from './store.ts'
import css from './BotChannelTab.module.css'

export interface BindingRow {
  kind: Kind
  boundAt: string
  sessionId: string
}

const KIND_LABELS: Record<Kind, string> = {
  wechat: '微信',
  feishu: '飞书',
}

export interface BindingsTableProps {
  bindings: readonly BindingRow[]
  t: (key: string) => string
  onRemove: (row: BindingRow) => void
}

export function BindingsTable({ bindings, t, onRemove }: BindingsTableProps) {
  return (
    <div className={css.bindings}>
      <h3 className={css.bindingsTitle}>{t('bindings.title')}（{bindings.length}）</h3>
      {bindings.length === 0 && <p className={css.bindingsEmpty}>{t('bindings.empty')}</p>}
      {bindings.length > 0 && (
        <table className={css.bindingsTable}>
          <thead>
            <tr>
              <th>{t('bindings.kind')}</th>
              <th>{t('bindings.session')}</th>
              <th>{t('bindings.boundAt')}</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {bindings.map((row, index) => (
              <tr key={`${row.kind}:${row.sessionId}:${index}`}>
                <td><span className={css.bindingKind}>{KIND_LABELS[row.kind] ?? row.kind}</span></td>
                <td className={css.bindingSession}>{row.sessionId}</td>
                <td>{row.boundAt.replace('T', ' ').slice(0, 19)}</td>
                <td>
                  <button type="button" className={css.bindingRemove} onClick={() => { onRemove(row) }}>
                    {t('bindings.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}