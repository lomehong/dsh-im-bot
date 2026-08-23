import { describe, expect, it } from 'vitest'

import { publicMcpToolName, sanitizeServerName } from '../src/channels/wecom/mcp-tool-name.ts'

describe('sanitizeServerName', () => {
  it('keeps legal characters untouched', () => {
    expect(sanitizeServerName('wecom-server_1')).toBe('wecom-server_1')
  })

  it('maps pure-CJK names to a stable distinguishing hash', () => {
    // 纯非 ASCII 名清洗后只剩下划线，多个中文 server 会撞名：
    // 改用稳定 FNV-1a 哈希片段（见 mcp-tool-name.ts 注释）。
    expect(sanitizeServerName('待办服务器')).toMatch(/^srv_[0-9a-f]{8}$/)
    // 同名稳定：同一输入永远归一化到同一片段。
    expect(sanitizeServerName('待办服务器')).toBe(sanitizeServerName('待办服务器'))
    // 不同中文名片段不同（可区分）。
    expect(sanitizeServerName('待办服务器')).not.toBe(sanitizeServerName('日程服务器'))
  })

  it('falls back to a placeholder only for empty input', () => {
    expect(sanitizeServerName('')).toBe('server')
    // '$$$' 清洗后只剩下划线，与纯 CJK 同样走稳定哈希分支（可区分）。
    expect(sanitizeServerName('$$$')).toMatch(/^srv_[0-9a-f]{8}$/)
  })
})

describe('publicMcpToolName', () => {
  it('builds mcp__<server>__<tool> for legal names', () => {
    expect(publicMcpToolName('wecom', 'list-meetings')).toBe('mcp__wecom__list-meetings')
  })

  it('sanitizes CJK server names via stable hash', () => {
    // 待办 → srv_<hash>，拼上前后分隔符：mcp__ + srv_xxxx + __ + add
    expect(publicMcpToolName('待办', 'add')).toMatch(/^mcp__srv_[0-9a-f]{8}__add$/)
    expect(publicMcpToolName('待办', 'add')).toBe(publicMcpToolName('待办', 'add'))
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
