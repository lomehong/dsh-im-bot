/**
 * SectionView 单测（0.1.7 契约）：
 * - read() 返回构造基线（Loader 注入的 apply(config)——插件重载即最新，
 *   不再存在 installSection/setSource-once 语义，见 docs/migration-0.1.7.md §1）；
 * - adopt() 保留为 source 换接 API（当前生产代码不再调用，契约仍固定）。
 *
 * 历史背景：0.1.6 的 installSection/setSource-once 曾造成「闭包缓存快照 →
 * 运行期改动全部失效」事故，彼时以本视图惰性求值根治；0.1.7 设置系统重写后
 * 事故前提（运行期换引用而不重载插件）不复存在。
 */
import { describe, expect, it } from 'vitest'
import { createSectionView } from '../src/plugin/section-view.ts'

interface TestSection {
  greeting: string
}

describe('createSectionView（0.1.7：Loader 配置即权威）', () => {
  it('read() 返回构造基线', () => {
    const baseline: TestSection = { greeting: 'from-loader' }
    const view = createSectionView<TestSection>(baseline)
    expect(view.read().greeting).toBe('from-loader')
  })

  it('adopt() 换接 source 后 read() 跟随新来源', () => {
    const view = createSectionView<TestSection>({ greeting: 'initial' })
    expect(view.read().greeting).toBe('initial')
    view.adopt(() => ({ greeting: 'reloaded' }))
    expect(view.read().greeting).toBe('reloaded')
    // 惰性求值：再次 read 走当前 source，非一次性快照
    expect(view.read().greeting).toBe('reloaded')
  })
})
