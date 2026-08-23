import { describe, expect, it } from 'vitest'

import { publicMcpToolName, sanitizeServerName } from '../src/channels/wecom/mcp-tool-name.ts'

describe('sanitizeServerName', () => {
  it('keeps legal characters untouched', () => {
    expect(sanitizeServerName('wecom-server_1')).toBe('wecom-server_1')
  })

  it('replaces illegal characters (incl. CJK) with underscore', () => {
    expect(sanitizeServerName('待办服务器')).toBe('_____')
  })

  it('falls back to a placeholder only for empty input', () => {
    expect(sanitizeServerName('')).toBe('server')
    // '$$$' 替换后为 '___'（非空），保留下划线而非占位符
    expect(sanitizeServerName('$$$')).toBe('___')
  })
})

describe('publicMcpToolName', () => {
  it('builds mcp__<server>__<tool> for legal names', () => {
    expect(publicMcpToolName('wecom', 'list-meetings')).toBe('mcp__wecom__list-meetings')
  })

  it('sanitizes CJK server names', () => {
    // 待办 → '__'，拼上前后分隔符：mcp__ + __ + __ + add
    expect(publicMcpToolName('待办', 'add')).toBe('mcp______add')
  })

  it('stays within 64 chars and legal charset for long raw names', () => {
    const raw = 'a'.repeat(200)
    const name = publicMcpToolName('server', raw)
    expect(name.length).toBeLessThanOrEqual(64)
    expect(name).toMatch(/^mcp__server__[A-Za-z0-9_-]+$/)
  })

  it('is deterministic (same input → same name)', () => {
    const raw = '很长的工具名字'.repeat(10)
    expect(publicMcpToolName('s', raw)).toBe(publicMcpToolName('s', raw))
  })

  it('distinguishes different raw names that share a truncated prefix', () => {
    const a = 'x'.repeat(80) + 'A'
    const b = 'x'.repeat(80) + 'B'
    expect(publicMcpToolName('s', a)).not.toBe(publicMcpToolName('s', b))
  })
})
