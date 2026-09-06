/**
 * Bindings table: list of IM-user-to-session rows with a remove button each.
 * Owns no fetching — the parent passes the rows + remove callback so the
 * polling lifecycle stays in one place.
 */
import type { Kind } from './store.ts'
import css from './BotChannelTab.module.css'

// ISO(UTC) → 查看者本地时区（存储保持 UTC，仅展示层转换）
function formatLocal(iso: string | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export interface BindingRow {
  kind: Kind
  boundAt: string
  sessionId: string
}

const KIND_LABELS: Record<Kind, string> = {
  wechat: '微信',
  feishu: '飞书',
  wecom: '企业微信',
}

export interface BindingsTableProps {
  bindings: readonly BindingRow[]
  t: (key: string) => string
  onRemove: (row: BindingRow) => void
  onTest?: (row: BindingRow) => void
}

export function BindingsTable({ bindings, t, onRemove, onTest }: BindingsTableProps) {
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
                <td>{formatLocal(row.boundAt)}</td>
                <td>
                  {onTest !== undefined && (
                    <button type="button" className={css.bindingRemove} style={{ marginRight: '8px' }} onClick={() => { onTest?.(row) }}>
                      测试
                    </button>
                  )}
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