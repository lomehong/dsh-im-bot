/**
 * 套件状态坞握手（dsh-twin suite-dock 契约，客户端侧感知端）。
 *
 * 常量为 dsh-twin/src/client/suite-dock-model.ts 的拷贝（宪章 §3.1：套件包
 * 之间零运行时共享）。语义：dock 挂载期每 30s 写 localStorage 心跳
 * `dsh-suite-dock`；本侧见心跳 → 自己的常驻角标让位（组件渲染 null）；
 * 键被清（dock 卸载）或超过宽限期无心跳（twin 已移除）→ 自动回归常驻。
 */
import { useEffect, useState } from 'react'

export const DOCK_STORAGE_KEY = 'dsh-suite-dock'
/** 宽限期：心跳即使过期，10 分钟内仍视为在场（页面冷启动时 dock 尚未写
 *  首次心跳——v0.1.8 实测按「新鲜度」初判会让横签闪现一下再消失）。 */
export const DOCK_STALE_MS = 10 * 60_000
export const EV_READY = 'suite-dock:ready'
export const EV_GONE = 'suite-dock:gone'

function safeGet(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(DOCK_STORAGE_KEY) : null
  } catch {
    return null
  }
}

/**
 * dock 是否在场。初值保守：键存在（哪怕过期）即让位——消除首帧竞态闪现；
 * 随后按宽限语义复查：键被清或超过 DOCK_STALE_MS 无心跳才回归常驻。
 */
export function useDockPresent(): boolean {
  const [present, setPresent] = useState(() => safeGet() !== null)
  useEffect(() => {
    const recheck = (): void => {
      const raw = safeGet()
      if (raw === null) {
        setPresent(false)
        return
      }
      const t = Date.parse(raw)
      setPresent(!(Number.isFinite(t) && Date.now() - t > DOCK_STALE_MS))
    }
    recheck()
    window.addEventListener(EV_READY, recheck)
    window.addEventListener(EV_GONE, recheck)
    const t = window.setInterval(recheck, 10_000)
    return () => {
      window.removeEventListener(EV_READY, recheck)
      window.removeEventListener(EV_GONE, recheck)
      window.clearInterval(t)
    }
  }, [])
  return present
}
