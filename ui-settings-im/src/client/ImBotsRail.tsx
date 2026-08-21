/**
 * IM 机器人状态栏：挂在 shell.overlay 的右缘竖向小组件。
 *
 * 常驻形态 = 折叠竖签（三个平台的图标 + 状态点，一眼可见）；点击展开成
 * Tab 化状态卡——头部三平台 Tab（微信/飞书/企业微信），主体为选中平台
 * 的机器人本体行（账号 + 在线状态 + 绑定数）与绑定明细列表（Owner/
 * 访客、脱敏用户标识、绑定时间）。Tab 记住上次选中（组件内状态）。
 *
 * 数据来自 GET /im-channel/bots/status，30 秒轮询（页面隐藏时暂停）。
 *
 * 位置避让：AppFrame 把三列宽度写在 frame 元素的 grid-template-columns
 * 内联样式里（第三列 = 右侧详情栏，0 = 收起）。本组件通过 MutationObserver
 * 跟踪该样式，把 right 偏移设为详情栏当前宽度——详情栏打开时状态栏
 * 平移到其左侧，收起时贴回视口右缘；transition 与 frame 的列过渡同速。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ImKey } from './locales.ts'
import { WechatMark, FeishuMark, WecomMark } from './platform-marks.tsx'

interface ImBotBindingUI {
  userId: string
  isMaster: boolean
  boundAt: string
  sessionId: string
}

interface ImBotStatusUI {
  kind: 'wechat' | 'feishu' | 'wecom'
  label: string
  configured: boolean
  online: boolean
  account: string | undefined
  boundUsers: number
  bindings: ImBotBindingUI[]
}

export interface ImBotsRailInjected {
  t: (key: ImKey) => string
}

const POLL_MS = 30_000

/** 状态点颜色（语义色，明暗主题通用）。 */
const DOT_ONLINE = '#2A9D8F'
const DOT_OFFLINE = '#B7791F'
const DOT_UNBOUND = '#B9B9B9'

/** Tab 顺序与折叠竖签一致。 */
const ORDER: Array<ImBotStatusUI['kind']> = ['wechat', 'feishu', 'wecom']

function PlatformMark({ kind, size }: { kind: ImBotStatusUI['kind'], size: number }): React.ReactElement {
  if (kind === 'wechat') return <WechatMark size={size} />
  if (kind === 'feishu') return <FeishuMark size={size} />
  return <WecomMark size={size} />
}

function dotColor(bot: ImBotStatusUI | undefined): string {
  if (bot === undefined) return DOT_UNBOUND
  if (!bot.configured) return DOT_UNBOUND
  return bot.online ? DOT_ONLINE : DOT_OFFLINE
}

/** 相对时间：xx 分钟前 / xx 小时前 / xx 天前，超过 30 天显示日期。 */
function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return iso
  const elapsed = Math.max(0, now - at)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days <= 30) return `${days} 天前`
  return new Date(at).toLocaleDateString()
}

/** 从 frame 的 grid-template-columns 解析右侧详情列宽（px；解析失败 0）。 */
function detailsWidthOf(frame: HTMLElement): number {
  const tracks = frame.style.gridTemplateColumns
  if (tracks === '') return 0
  const last = tracks.trim().split(/\s+/).at(-1) ?? ''
  const px = Number.parseFloat(last)
  return Number.isFinite(px) ? Math.max(0, px) : 0
}

export function ImBotsRail({ t }: ImBotsRailInjected): React.ReactElement {
  const [bots, setBots] = useState<ImBotStatusUI[] | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<ImBotStatusUI['kind'] | undefined>(undefined)
  const [detailsWidth, setDetailsWidth] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const resp = await fetch('/im-channel/bots/status')
      const data = await resp.json() as { ok: boolean, bots?: ImBotStatusUI[] }
      if (data.ok && Array.isArray(data.bots)) {
        setBots(data.bots)
        setLoadError(false)
      } else {
        setLoadError(true)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  // 轮询：页面隐藏时暂停（回到前台立即刷新一次）。
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, POLL_MS)
    const onVisible = (): void => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const toggleExpanded = useCallback((): void => {
    const next = !expanded
    setExpanded(next)
    if (next) void refresh()
  }, [expanded, refresh])

  // 跟随右侧详情栏宽度：root.parentElement = overlay 层，其父 = frame。
  useLayoutEffect(() => {
    const root = rootRef.current
    if (root === null) return
    const frame = root.parentElement?.parentElement ?? null
    if (frame === null) return
    let raf = 0
    const measure = (): void => {
      raf = 0
      setDetailsWidth(prev => {
        const next = detailsWidthOf(frame)
        return prev === next ? prev : next
      })
    }
    const observer = new MutationObserver(() => {
      if (raf === 0) raf = requestAnimationFrame(measure)
    })
    observer.observe(frame, { attributes: true, attributeFilter: ['style'] })
    measure()
    return () => {
      observer.disconnect()
      if (raf !== 0) cancelAnimationFrame(raf)
    }
  }, [])

  const byKind = useMemo(() => new Map(bots?.map(b => [b.kind, b]) ?? []), [bots])
  // Tab 记住上次选中；首次展开默认第一个平台。
  const active = activeTab ?? ORDER[0]
  const activeBot = byKind.get(active)

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        right: `${detailsWidth}px`,
        transition: 'right var(--ds-transition-duration-slow, 0.3s) var(--ds-ease-in-out, ease-in-out)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {expanded && (
        <div
          role="status"
          style={{
            width: 292,
            borderRadius: 12,
            padding: '12px 14px',
            background: 'var(--dsw-alias-bg-base, #fff)',
            border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.14)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('rail.title')}</span>
            <button
              type="button"
              aria-label={t('rail.collapse')}
              onClick={toggleExpanded}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, padding: '2px 4px' }}
            >
              ›
            </button>
          </div>

          {loadError && bots === undefined && (
            <div style={{ fontSize: 12, color: DOT_OFFLINE, display: 'flex', gap: 8, alignItems: 'center' }}>
              {t('rail.loadError')}
              <button type="button" onClick={() => { void refresh() }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                {t('rail.retry')}
              </button>
            </div>
          )}

          {/* 平台 Tab 行：图标 + 平台名 + 状态点 */}
          <div role="tablist" aria-label={t('rail.title')} style={{ display: 'flex', gap: 4, borderBottom: '1px solid color-mix(in srgb, currentColor 14%, transparent)', paddingBottom: 6 }}>
            {ORDER.map(kind => {
              const bot = byKind.get(kind)
              const selected = kind === active
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => { setActiveTab(kind) }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '6px 2px',
                    fontSize: 12,
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: 8,
                    color: 'inherit',
                    background: selected ? 'color-mix(in srgb, currentColor 8%, transparent)' : 'transparent',
                    fontWeight: selected ? 600 : 400,
                    borderBottom: selected ? `2px solid ${DOT_ONLINE}` : '2px solid transparent',
                  }}
                >
                  <PlatformMark kind={kind} size={16} />
                  <span>{bot?.label ?? kind}</span>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor(bot), flex: 'none' }} />
                </button>
              )
            })}
          </div>

          {/* ① 机器人本体行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px 2px', opacity: activeBot !== undefined && activeBot.configured ? 1 : 0.55 }}>
            <PlatformMark kind={active} size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                {activeBot?.label}
                <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: 6, fontSize: 11 }}>
                  {activeBot === undefined || !activeBot.configured
                    ? t('rail.unbound')
                    : activeBot.online ? t('rail.online') : t('rail.offline')}
                </span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeBot?.account ?? '—'}
              </div>
            </div>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', background: dotColor(activeBot) }} />
          </div>

          {/* ② 绑定明细列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 208, overflowY: 'auto', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
            {(activeBot?.bindings.length ?? 0) === 0 && (
              <div style={{ fontSize: 11.5, opacity: 0.55, padding: '8px 2px' }}>{t('rail.bindingsNone')}</div>
            )}
            {activeBot?.bindings.map(binding => (
              <div key={`${binding.sessionId}-${binding.userId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 11.5 }}>
                <span
                  title={binding.isMaster ? t('rail.owner') : t('rail.guest')}
                  style={{
                    flex: 'none',
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: binding.isMaster ? 'color-mix(in srgb, #B7791F 18%, transparent)' : 'color-mix(in srgb, currentColor 8%, transparent)',
                    color: binding.isMaster ? '#B7791F' : 'inherit',
                    opacity: binding.isMaster ? 1 : 0.7,
                  }}
                >
                  {binding.isMaster ? `👑 ${t('rail.owner')}` : t('rail.guest')}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }} title={binding.sessionId}>
                  {binding.userId}
                </span>
                <span style={{ flex: 'none', opacity: 0.6 }}>{relativeTime(binding.boundAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 折叠竖签：三平台图标 + 状态点，常驻可见 */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t('rail.collapse') : t('rail.expand')}
        title={expanded ? t('rail.collapse') : t('rail.expand')}
        onClick={toggleExpanded}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '10px 5px',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '10px 0 0 10px',
          background: 'var(--dsw-alias-bg-base, #fff)',
          borderLeft: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
          borderTop: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
          borderBottom: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
          boxShadow: '-3px 3px 14px rgba(0, 0, 0, 0.12)',
          color: 'inherit',
        }}
      >
        {ORDER.map(kind => {
          const bot = byKind.get(kind)
          return (
            <span key={kind} style={{ position: 'relative', display: 'inline-flex' }}>
              <PlatformMark kind={kind} size={18} />
              <span
                aria-hidden
                style={{ position: 'absolute', right: -3, bottom: -2, width: 8, height: 8, borderRadius: '50%', background: dotColor(bot), boxShadow: '0 0 0 2px var(--dsw-alias-bg-base, #fff)' }}
              />
            </span>
          )
        })}
        <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>{expanded ? '›' : '‹'}</span>
      </button>
    </div>
  )
}
