/**
 * 回归测试：settings 节视图必须读到最新值（防陈旧快照事故）。
 *
 * 用真实 cordis Context + 真实 dsh-settings（内存 Provider 子类）+ 真实
 * installSettingsSection 驱动，复刻线上语义：
 *   - commit 是「换引用」（deepEqual 不等时替换 resolved 对象）；
 *   - setSource 仅在注册时调用一次，变更只触发 onChange（不携带新值）。
 *
 * 事故背景：插件曾把 source() 的结果存进闭包变量（一次性快照），运行期
 * 加实例/存凭证后 rebuildRouter 读到启动时刻的空配置而永远空跑。本测试
 * 断言通过 SectionView 惰性求值能在 onChange 内拿到新值，并固定
 * setSource-once 契约（若上游语义变化，此处会第一时间暴露）。
 */
import { Context } from '@deepseek-ai/cordis'
import Settings, { installSettingsSection } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { describe, expect, it } from 'vitest'
import { createSectionView } from '../src/plugin/section-view.ts'

/** 内存 settings：基类无 Provider，load 返回空文档、可写。 */
class MemorySettings extends Settings {
  writable = true
  load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }
}

interface TestSection {
  greeting: string
}

const Schema = z.object({
  greeting: z.string().default('initial'),
})

/** 排空 watcher 的 promise tail（commit 走 tail.then 链）。 */
const flushWatchers = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20))

describe('SectionView against real dsh-settings semantics', () => {
  it('reads the freshly committed value inside onChange (no stale snapshot)', async () => {
    const entry: TestSection = { greeting: 'initial' }
    const view = createSectionView<TestSection>(entry)
    let setSourceCalls = 0
    let seenOnChange: TestSection | undefined

    const ctx = new Context({})
    let service: MemorySettings | undefined
    ctx.plugin({
      name: 'test:memory-settings',
      apply(inner) {
        service = new MemorySettings(inner)
      },
    })
    ctx.plugin({
      name: 'test:consumer',
      apply(consumerCtx) {
        installSettingsSection(consumerCtx, 'test.section-view', Schema as unknown as z<TestSection>, entry, {
          setSource: (source) => {
            setSourceCalls++
            view.adopt(source)
          },
          onChange: () => {
            // 与插件 rebuildRouter 相同的读取方式：进入回调时惰性求值。
            seenOnChange = view.read()
          },
        })
      },
    })
    // installSettingsSection 的 inject 回调走微任务；排空后 source 已 adopt。
    await flushWatchers()

    // 注册即解析：未变更前读到的是组合基线。
    expect(setSourceCalls).toBe(1)
    expect(view.read().greeting).toBe('initial')
    const baseline = view.read()

    // 运行期变更（等价于设置页保存）：publish → commit——deepEqual 不等
    // → 换引用 → 通知 watcher → onChange。
    service!.publish({ 'test.section-view': { greeting: 'changed-at-runtime' } })
    await flushWatchers()

    // ① setSource 仍只调用过一次——契约固定（变更不重发 source）。
    expect(setSourceCalls).toBe(1)
    // ② onChange 内读到的是新值（事故形态下这里仍是 'initial'）。
    expect(seenOnChange?.greeting).toBe('changed-at-runtime')
    // ③ commit 换引用：新旧值不是同一对象（快照必然陈旧的原因）。
    expect(view.read()).not.toBe(baseline)
    expect(view.read().greeting).toBe('changed-at-runtime')

    // 再变更一次，确认视图持续跟随（非一次性）。
    service!.publish({ 'test.section-view': { greeting: 'changed-again' } })
    await flushWatchers()
    expect(view.read().greeting).toBe('changed-again')
    expect(seenOnChange?.greeting).toBe('changed-again')
  })
})
