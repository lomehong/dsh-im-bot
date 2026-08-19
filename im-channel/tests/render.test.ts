import { describe, expect, it } from 'vitest'
import { interruptedNote, modeOf, renderFinal, renderLive } from '../src/core/render.ts'

describe('modeOf', () => {
  it('maps /回复 levels to turn modes', () => {
    expect(modeOf('简洁')).toBe('quiet')
    expect(modeOf('详细')).toBe('verbose')
    expect(modeOf('标准')).toBe('normal')
    expect(modeOf(undefined)).toBe('normal')
  })
})

describe('renderFinal', () => {
  const messages = ['第一段', '第二段']
  const toolLines = ['🔧 bash', '   ✓ ok']

  it('quiet returns only the last message', () => {
    expect(renderFinal('quiet', messages, toolLines)).toBe('第二段')
  })

  it('normal joins every message', () => {
    expect(renderFinal('normal', messages, toolLines)).toBe('第一段\n\n第二段')
  })

  it('verbose prefixes tool lines', () => {
    expect(renderFinal('verbose', messages, toolLines)).toBe('🔧 bash\n   ✓ ok\n──────────\n第一段\n第二段')
  })

  it('empty turns render empty', () => {
    expect(renderFinal('quiet', [], [])).toBe('')
    expect(renderFinal('normal', [], [])).toBe('')
  })
})

describe('renderLive', () => {
  it('quiet tracks activity without leaking content', () => {
    expect(renderLive('quiet', ['机密回复'], [], 0)).toBe('⏳ 已收到，正在处理…')
    expect(renderLive('quiet', ['机密回复'], ['🔧 bash'], 1)).toBe('⏳ 处理中，已执行 1 次工具调用…')
  })

  it('normal streams completed segments with a thinking placeholder', () => {
    expect(renderLive('normal', [], [], 0)).toBe('⏳ 正在思考…')
    expect(renderLive('normal', ['第一段'], [], 0)).toBe('第一段')
  })

  it('normal shows tool activity while no text has arrived yet', () => {
    expect(renderLive('normal', [], [], 3)).toBe('⏳ 正在执行任务（已调用 3 次工具）…')
    expect(renderLive('normal', [], ['🔧 bash', '   ✓ ok'], 1)).toBe('⏳ 正在执行任务（已调用 1 次工具）…')
  })

  it('appends the streaming partial after finalized segments', () => {
    expect(renderLive('normal', ['第一段'], [], 0, '写到一半')).toBe('第一段\n\n写到一半')
    expect(renderLive('normal', [], [], 0, '刚开始')).toBe('刚开始')
    expect(renderLive('verbose', ['第一段'], ['🔧 bash'], 1, '续写')).toBe('🔧 bash\n──────────\n第一段\n\n续写')
  })

  it('verbose interleaves tool progress and segments', () => {
    expect(renderLive('verbose', ['第一段'], ['🔧 bash', '   ✓ ok'], 1)).toBe('🔧 bash\n   ✓ ok\n──────────\n第一段')
  })
})

describe('interruptedNote', () => {
  it('annotates partial output when superseded', () => {
    expect(interruptedNote('写到一半')).toBe('⏹ 本轮已被新消息中断，以下为未完成的部分：\n\n写到一半')
    expect(interruptedNote('')).toBe('⏹ 本轮已被新消息中断。')
  })
})

describe('renderLive todos', () => {
  it('verbose renders the todo snapshot above tool lines', () => {
    const todos = [
      { content: '扫描代码', status: 'completed' },
      { content: '写测试', status: 'in_progress' },
      { content: '提交', status: 'pending' },
    ]
    const view = renderLive('verbose', ['第一段'], [], 0, '', todos)
    expect(view).toContain('☑ 扫描代码')
    expect(view).toContain('◐ 写测试')
    expect(view).toContain('☐ 提交')
    expect(view).toContain('第一段')
  })

  it('normal mode ignores todos', () => {
    const view = renderLive('normal', ['回复'], [], 0, '', [{ content: '任务', status: 'pending' }])
    expect(view).toBe('回复')
  })
})
