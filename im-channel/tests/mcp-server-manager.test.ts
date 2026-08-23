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

const {
  parseMcpImport, addMcpServer, updateMcpServer, normalizeMcpUrl,
  defaultNameFromUrl, defaultNameFromCommand, serverEntryToConfig,
  McpManagerError, loadMcpServers,
} = await import('../src/channels/mcp-server-manager.ts')

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

  it('imports stdio (command) entries as candidates with args/env', () => {
    const result = parseMcpImport(JSON.stringify({
      mcpServers: {
        '本地': { command: 'npx', args: ['-y', 'some-server'], env: { KEY: 'value' } },
      },
    }))
    expect(result.candidates).toEqual([
      { name: '本地', url: '', command: 'npx', args: ['-y', 'some-server'], env: { KEY: 'value' } },
    ])
    expect(result.unsupported).toEqual([])
  })

  it('preserves headers on http entries', () => {
    const result = parseMcpImport(JSON.stringify({
      mcpServers: {
        'auth': { url: 'https://auth.example.com/mcp', headers: { Authorization: 'Bearer t' } },
      },
    }))
    expect(result.candidates).toEqual([
      { name: 'auth', url: 'https://auth.example.com/mcp', headers: { Authorization: 'Bearer t' } },
    ])
  })

  it('de-duplicates same URL or same stdio command within one paste', () => {
    const urlPaste = parseMcpImport('https://a.example.com/mcp\nhttps://a.example.com/mcp')
    expect(urlPaste.candidates).toHaveLength(1)
    const stdioPaste = parseMcpImport(JSON.stringify({
      mcpServers: {
        '甲': { command: 'npx', args: ['-y', 'x'] },
        '乙': { command: 'npx', args: ['-y', 'x'] },
      },
    }))
    expect(stdioPaste.candidates).toHaveLength(1)
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

  it('rejects entries with neither url nor command', () => {
    expect(() => addMcpServer({ enabled: true }))
      .toThrowError(expect.objectContaining({ code: 'invalid-url' }))
  })

  it('adds stdio entries with command-derived names', () => {
    const entry = addMcpServer({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], enabled: true })
    expect(entry.name).toBe('npx')
    expect(entry.type).toBe('stdio')
    expect(entry.url).toBe('')
    expect(entry.command).toBe('npx')
  })

  it('rejects duplicate stdio command+args', () => {
    expect(() => addMcpServer({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], enabled: true }))
      .toThrowError(expect.objectContaining({ code: 'duplicate' }))
  })

  it('sanitizes headers, keeping only string values', () => {
    const entry = addMcpServer({
      url: 'https://hdr.example.com/mcp',
      enabled: true,
      headers: { Authorization: 'Bearer x', bad: 123 as unknown as string },
    })
    expect(entry.headers).toEqual({ Authorization: 'Bearer x' })
  })

  it('persists with restrictive file mode', () => {
    addMcpServer({ name: 'mode', type: 'streamable-http', url: 'https://mode.example.com/mcp', enabled: true })
    const raw = readFileSync(join(tempHome, '.dsh', 'im-channel', 'credentials', 'mcp-servers.json'), 'utf8')
    expect(JSON.parse(raw).servers.length).toBeGreaterThan(0)
  })
})

describe('updateMcpServer', () => {
  it('clears headers when updated with an empty map', () => {
    const entry = addMcpServer({
      url: 'https://clear.example.com/mcp',
      enabled: true,
      headers: { 'X-Token': 'abc' },
    })
    expect(entry.headers).toEqual({ 'X-Token': 'abc' })
    expect(updateMcpServer(entry.id, { headers: {} })).toBe(true)
    const stored = loadMcpServers().find(s => s.id === entry.id)
    expect(stored?.headers).toBeUndefined()
  })
})

describe('defaultNameFromUrl', () => {
  it('strips the www. prefix', () => {
    expect(defaultNameFromUrl('https://www.example.com/mcp')).toBe('example.com')
  })
})

describe('defaultNameFromCommand', () => {
  it('uses the command basename without extension', () => {
    expect(defaultNameFromCommand('npx')).toBe('npx')
    expect(defaultNameFromCommand('C:\\tools\\memory-server.exe')).toBe('memory-server')
    expect(defaultNameFromCommand('/usr/local/bin/mcp-memory')).toBe('mcp-memory')
  })
})

describe('serverEntryToConfig', () => {
  it('maps http entries without leaking empty stdio fields', () => {
    const config = serverEntryToConfig({
      id: 'x', name: 'web', type: 'streamable-http', url: 'https://a.example.com/mcp', enabled: true,
      headers: { Authorization: 'Bearer t' },
    })
    expect(config).toEqual({ name: 'web', url: 'https://a.example.com/mcp', headers: { Authorization: 'Bearer t' } })
  })

  it('maps stdio entries without a url field', () => {
    const config = serverEntryToConfig({
      id: 'y', name: '本地', type: 'stdio', url: '', enabled: true,
      command: 'npx', args: ['-y', 'srv'], env: { K: 'v' },
    })
    expect(config).toEqual({ name: '本地', command: 'npx', args: ['-y', 'srv'], env: { K: 'v' } })
    expect(config.url).toBeUndefined()
  })
})
