import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'

// Redirect the store file into a per-run temp HOME before any BindStore
// import: these tests call bind(), whose debounced flush must never touch
// the developer's real ~/.dsh/im-channel/bindings.json.
const guardHome = mkdtempSync(join(tmpdir(), 'im-channel-guest-'))
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => guardHome }
})

import { DEFAULT_GUEST_COMMANDS, guestToolDenied, matchesToolPattern } from '../src/core/guest-permissions.ts'
import { BindStore } from '../src/core/bind-store.ts'

afterAll(() => {
  try {
    rmSync(guardHome, { recursive: true, force: true })
  } catch {
    // Windows file locks; the OS temp cleaner will take it.
  }
})
describe('matchesToolPattern', () => {
  it('matches exact names only when no wildcard', () => {
    expect(matchesToolPattern('bash', ['bash'])).toBe(true)
    expect(matchesToolPattern('bash_persistent', ['bash'])).toBe(false)
  })

  it('prefix wildcards cover tool families and MCP namespaces', () => {
    expect(matchesToolPattern('fs_read', ['fs*'])).toBe(true)
    expect(matchesToolPattern('fs', ['fs*'])).toBe(true)
    expect(matchesToolPattern('mcp__wecom_send', ['mcp__wecom*'])).toBe(true)
    expect(matchesToolPattern('bash', ['fs*'])).toBe(false)
  })

  it('an empty allowlist blocks everything', () => {
    expect(matchesToolPattern('bash', [])).toBe(false)
    expect(matchesToolPattern('web', [])).toBe(false)
  })

  it('the denial reason is model-facing and actionable', () => {
    expect(guestToolDenied('bash')).toContain('bash')
    expect(guestToolDenied('bash')).toContain('访客')
  })

  it('defaults keep guests conversational but tool-less', () => {
    expect(DEFAULT_GUEST_COMMANDS).toContain('帮助')
    expect(DEFAULT_GUEST_COMMANDS).not.toContain('项目')
  })
})

describe('BindStore.ownerFor', () => {
  it('returns the first master row per channel kind', () => {
    const store = new BindStore()
    store.bind({ kind: 'feishu', userId: 'ou_a' }, 'session-a', true)
    store.bind({ kind: 'feishu', userId: 'ou_b' }, 'session-b', true)
    store.bind({ kind: 'wecom', userId: 'wx_a' }, 'session-c', true)
    expect(store.ownerFor('feishu')?.userId).toBe('ou_a')
    expect(store.ownerFor('wecom')?.sessionId).toBe('session-c')
    expect(store.ownerFor('wechat')).toBeUndefined()
  })

  it('guest rows never claim ownership', () => {
    const store = new BindStore()
    store.bind({ kind: 'feishu', userId: 'ou_owner' }, 'session-1', true)
    store.bind({ kind: 'feishu', userId: 'ou_guest' }, 'session-1', false)
    expect(store.ownerFor('feishu')?.userId).toBe('ou_owner')
  })
})

describe('legacy owner migration', () => {
  it('promotes the earliest pre-isMaster row of an ownerless channel', async () => {
    // Write a pre-avatar bindings file (no isMaster anywhere) into the
    // guarded HOME, then re-evaluate bind-store fresh so its lazy load (and
    // the migration hooked into it) runs against that file.
    const file = join(guardHome, '.dsh', 'im-channel', 'bindings.json')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({
      bindings: [
        { kind: 'feishu', userId: 'ou_early', sessionId: 'session-1', boundAt: '2026-01-01T00:00:00Z' },
        { kind: 'feishu', userId: 'ou_late', sessionId: 'session-2', boundAt: '2026-02-01T00:00:00Z' },
      ],
    }), 'utf8')
    vi.resetModules()
    const { BindStore: FreshStore } = await import('../src/core/bind-store.ts')
    const store = new FreshStore()
    expect(store.ownerFor('feishu')?.userId).toBe('ou_early')
    store.flushSync()
    const persisted = JSON.parse(readFileSync(file, 'utf8')) as { bindings: Array<{ userId: string; isMaster?: boolean }> }
    expect(persisted.bindings.find(r => r.userId === 'ou_early')?.isMaster).toBe(true)
    expect(persisted.bindings.find(r => r.userId === 'ou_late')?.isMaster).toBeUndefined()
  })
})
