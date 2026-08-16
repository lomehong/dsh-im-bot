import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Redirect the store file into a per-test temp HOME before the module loads.
const tempHome = mkdtempSync(join(tmpdir(), 'im-channel-bind-'))
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => tempHome }
})

const { BindStore, listBindings, removeBinding } = await import('../src/core/bind-store.ts')
type ImUserId = import('../src/core/channel.ts').ImUserId

const USER = { kind: 'feishu' as const, userId: 'ou_123' as ImUserId }

let store: InstanceType<typeof BindStore>

beforeEach(() => {
  store = new BindStore()
})

afterEach(() => {
  store.flushSync()
})

afterAll(() => {
  try {
    rmSync(tempHome, { recursive: true, force: true })
  } catch {
    // Windows file locks; the OS temp cleaner will take it.
  }
})

describe('BindStore', () => {
  it('round-trips bindings, verbosity, workspace and last target', () => {
    store.bind(USER, 'session-a')
    store.setVerbosity(USER, '详细')
    store.selectWorkspace(USER, 'E:\\proj')
    store.rememberTarget(USER, 'oc_chat1')
    store.flushSync()

    const fresh = new BindStore()
    expect(fresh.sessionIdFor(USER)).toBe('session-a')
    expect(fresh.verbosityFor(USER)).toBe('详细')
    expect(fresh.workspaceFor(USER)).toBe('E:\\proj')
    expect(fresh.targetIdFor(USER)).toBe('oc_chat1')
  })

  it('replaces the row when rebinding the same user', () => {
    store.bind(USER, 'session-a')
    store.bind(USER, 'session-b')
    expect(store.sessionIdFor(USER)).toBe('session-b')
    store.flushSync()
    expect(new BindStore().sessionIdFor(USER)).toBe('session-b')
  })

  it('unbinds and reports', () => {
    store.bind(USER, 'session-a')
    expect(store.unbind(USER)).toBe(true)
    expect(store.unbind(USER)).toBe(false)
    expect(store.sessionIdFor(USER)).toBeUndefined()
  })

  it('keeps other rows when one is removed', () => {
    store.bind(USER, 'session-a')
    store.bind({ kind: 'wechat', userId: 'wx_1' as ImUserId }, 'session-b')
    store.unbind(USER)
    expect(store.sessionIdFor({ kind: 'wechat', userId: 'wx_1' as ImUserId })).toBe('session-b')
  })

  it('module helpers share the singleton and persist through it', () => {
    const other = { kind: 'wechat' as const, userId: 'wx_shared' as ImUserId }
    BindStore.shared.bind(other, 'session-shared')
    BindStore.shared.flushSync()
    // The shared cache sees earlier tests' flushed rows too; assert on the
    // row we just added rather than the whole file.
    expect(listBindings().some(r => r.kind === 'wechat' && r.sessionId === 'session-shared')).toBe(true)
    expect(removeBinding({ sessionId: 'session-shared' })).toBe(true)
    expect(listBindings().some(r => r.sessionId === 'session-shared')).toBe(false)
    BindStore.shared.flushSync()
    expect(existsSync(join(tempHome, '.dsh', 'im-channel', 'bindings.json'))).toBe(true)
    const raw = JSON.parse(readFileSync(join(tempHome, '.dsh', 'im-channel', 'bindings.json'), 'utf8')) as { bindings: Array<{ sessionId: string }> }
    expect(raw.bindings.some(r => r.sessionId === 'session-shared')).toBe(false)
  })
})
