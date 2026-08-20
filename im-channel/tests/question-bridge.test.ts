/**
 * Question-bridge tests: option rendering, reply parsing (numbers, labels,
 * multi-select, free text), lifecycle (pending, timeout, supersede).
 */
import { describe, expect, it, vi } from 'vitest'
import { QuestionBridge, QUESTION_TIMEOUT_MS, answerForQuestion, questionText } from '../src/plugin/question-bridge.ts'

const SINGLE = {
  id: 'q1',
  question: '选择数据库',
  options: [
    { label: 'PostgreSQL', description: '关系型' },
    { label: 'SQLite', description: '嵌入式' },
  ],
}
const MULTI = {
  id: 'q2',
  question: '选择关注范围',
  multiSelect: true,
  options: [{ label: '后端' }, { label: '前端' }, { label: '测试' }],
}
const FREE = { id: 'q3', question: '项目叫什么名字？' }

describe('answerForQuestion', () => {
  it('maps option numbers to labels', () => {
    expect(answerForQuestion(SINGLE, '1')).toEqual({ id: 'q1', selected: ['PostgreSQL'], custom: undefined })
    expect(answerForQuestion(SINGLE, '2')).toEqual({ id: 'q1', selected: ['SQLite'], custom: undefined })
  })

  it('maps option labels verbatim and with surrounding whitespace', () => {
    expect(answerForQuestion(SINGLE, ' SQLite ').selected).toEqual(['SQLite'])
  })

  it('multi-select collects comma-separated tokens and keeps custom leftovers', () => {
    const answer = answerForQuestion(MULTI, '1, 前端, 顺便看下部署')
    expect(answer.selected).toEqual(['后端', '前端'])
    expect(answer.custom).toBe('顺便看下部署')
  })

  it('single-select caps at one label', () => {
    expect(answerForQuestion(SINGLE, '1 2').selected).toEqual(['PostgreSQL'])
  })

  it('free-text questions take the whole reply as custom', () => {
    expect(answerForQuestion(FREE, 'dsh-im-bot')).toEqual({ id: 'q3', selected: [], custom: 'dsh-im-bot' })
  })

  it('no match at all falls back to custom text', () => {
    expect(answerForQuestion(SINGLE, '都不行').custom).toBe('都不行')
  })
})

describe('questionText', () => {
  it('renders numbered options with descriptions and hints', () => {
    const text = questionText([SINGLE])
    expect(text).toContain('1. PostgreSQL — 关系型')
    expect(text).toContain('回复一个选项序号或文字')
    expect(text).toContain('分钟内有效')
  })
})

describe('QuestionBridge', () => {
  function makeBridge(): { bridge: QuestionBridge; sent: string[] } {
    const sent: string[] = []
    return { bridge: new QuestionBridge(async (_k, _u, body) => { sent.push(body); return true }), sent }
  }

  it('renders the question to IM and resolves on the user reply', async () => {
    const { bridge, sent } = makeBridge()
    const answer = bridge.ask('feishu', 'ou_owner', [SINGLE])
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(sent[0]).toContain('选择数据库')
    expect(bridge.consumeReply('feishu', 'ou_owner', '1')).toBe(true)
    const resolved = await answer
    expect(resolved.answers[0]?.selected).toEqual(['PostgreSQL'])
  })

  it('slash commands are never consumed as answers', async () => {
    const { bridge } = makeBridge()
    const answer = bridge.ask('feishu', 'ou_owner', [FREE])
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(bridge.consumeReply('feishu', 'ou_owner', '/帮助', '/')).toBe(false)
    expect(bridge.hasPendingFor('feishu', 'ou_owner')).toBe(true)
    bridge.consumeReply('feishu', 'ou_owner', '我的答案是 X')
    const resolved = await answer
    expect(resolved.answers[0]?.custom).toBe('我的答案是 X')
  })

  it('only the asked user can answer; others pass through', async () => {
    const { bridge } = makeBridge()
    const answer = bridge.ask('feishu', 'ou_owner', [FREE])
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(bridge.consumeReply('feishu', 'ou_other', '答案')).toBe(false)
    bridge.consumeReply('feishu', 'ou_owner', '答案')
    await expect(answer).resolves.toBeDefined()
  })

  it('rejects on timeout', async () => {
    vi.useFakeTimers()
    try {
      const { bridge } = makeBridge()
      const answer = bridge.ask('feishu', 'ou_owner', [FREE])
      vi.advanceTimersByTime(QUESTION_TIMEOUT_MS + 1_000)
      await expect(answer).rejects.toThrow('超时')
    } finally {
      vi.useRealTimers()
    }
  })
})
