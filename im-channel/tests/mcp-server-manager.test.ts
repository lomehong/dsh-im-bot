import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

// Redirect the config file into a per-test temp HOME before the module loads,
// so addMcpServer writes never touch the developer's real ~/.dsh config.
const tempHome = mkdtempSync(join(tmpdir(), 'im-channel-mcp-'))
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => tempHome }
})

const { parseMcpImport, addMcpServer, normalizeMcpUrl, defaultNameFromUrl, McpManagerError, loadMcpServers } = await import('../src/channels/mcp-server-manager.ts')

afterAll(() => {
  try {
    rmSync(tempHome, { recursive: true, force: true })
  } catch {
    // Windows file locks; the OS temp cleaner will take it.
  }
})

describe('normalizeMcpUrl', () => {
  it('trims and normalizes valid http(s) URLs', () => {
    expect(normalizeMcpUrl('  https://mcp.example.com/mcp  ')).toBe('https://mcp.example.com/mcp')
  })

  it('rejects non-http protocols and malformed input', () => {
    expect(() => normalizeMcpUrl('ftp://example.com')).toThrow(McpManagerError)
    expect(() => normalizeMcpUrl('not a url')).toThrow(McpManagerError)
  })
})

describe('parseMcpImport', () => {
  it('parses bare URLs, one per line, with host-derived names', () => {
    const result = parseMcpImport('https://a.example.com/mcp\n\nhttps://b.example.com/mcp\n')
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toEqual({ name: 'a.example.com', url: 'https://a.example.com/mcp' })
    expect(result.invalid).toEqual([])
  })

  it('parses standard mcpServers JSON (Claude Code / Cursor format)', () => {
    const result = parseMcpImport(JSON.stringify({
      mcpServers: {
        '待办': { type: 'streamable-http', url: 'https://todo.example.com/mcp' },
      },
    }))
    expect(result.candidates).toEqual([{ name: '待办', url: 'https://todo.example.com/mcp' }])
    expect(result.unsupported).toEqual([])
  })

  it('marks stdio (command) entries as unsupported instead of importing', () => {
    const result = parseMcpImport(JSON.stringify({
      mcpServers: {
        '本地': { command: 'npx', args: ['-y', 'some-server'] },
      },
    }))
    expect(result.candidates).toEqual([])
    expect(result.unsupported).toHaveLength(1)
    expect(result.unsupported[0]?.name).toBe('本地')
    expect(result.unsupported[0]?.reason).toContain('stdio')
  })

  it('de-duplicates same URL within one paste and numbers duplicate names', () => {
    const result = parseMcpImport('https://a.example.com/mcp\nhttps://a.example.com/mcp')
    expect(result.candidates).toHaveLength(1)
  })

  it('collects unrecognizable lines into invalid instead of throwing', () => {
    const result = parseMcpImport('hello world\n{"broken": 1}')
    expect(result.candidates).toEqual([])
    expect(result.invalid.length).toBeGreaterThan(0)
  })

  it('returns empty result for empty input', () => {
    expect(parseMcpImport('   ')).toEqual({ candidates: [], unsupported: [], invalid: [] })
  })
})

describe('addMcpServer', () => {
  it('auto-derives name from host when name is omitted', () => {
    const entry = addMcpServer({ type: 'streamable-http', url: 'https://www.remember.example.com/mcp', enabled: true })
    expect(entry.name).toBe('remember.example.com')
    expect(loadMcpServers()).toHaveLength(1)
  })

  it('rejects duplicate URLs with a duplicate-coded error', () => {
    addMcpServer({ name: '第一个', type: 'streamable-http', url: 'https://dup.example.com/mcp', enabled: true })
    expect(() => addMcpServer({ name: '第二个', type: 'streamable-http', url: 'https://dup.example.com/mcp', enabled: true }))
      .toThrowError(expect.objectContaining({ code: 'duplicate' }))
  })

  it('rejects invalid URLs', () => {
    expect(() => addMcpServer({ type: 'streamable-http', url: 'javascript:alert(1)', enabled: true })).toThrow(McpManagerError)
  })

  it('persists with restrictive file mode', () => {
    addMcpServer({ name: 'mode', type: 'streamable-http', url: 'https://mode.example.com/mcp', enabled: true })
    const raw = readFileSync(join(tempHome, '.dsh', 'im-channel', 'credentials', 'mcp-servers.json'), 'utf8')
    expect(JSON.parse(raw).servers.length).toBeGreaterThan(0)
  })
})

describe('defaultNameFromUrl', () => {
  it('strips the www. prefix', () => {
    expect(defaultNameFromUrl('https://www.example.com/mcp')).toBe('example.com')
  })
})
