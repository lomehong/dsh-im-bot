import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ImUserRef } from './channel.ts'

/** Mapping row: one IM user bound to one harness session id. */
export interface Binding {
  readonly kind: ImUserRef['kind']
  readonly userId: string
  /** Harness session id the IM user chats through. */
  sessionId: string
  boundAt: string
  /** Reply verbosity preference (/回复): '简洁' | '标准' | '详细'. */
  verbosity?: '简洁' | '标准' | '详细'
  /** Workspace path chosen via /项目; new sessions start here. */
  workspace?: string
  /** Last chat target the user wrote from (Feishu chat_id, ...); enables proactive sends after restarts. */
  lastTargetId?: string
  /** 是否为主人（通过 /bind 绑定），false 或 undefined 表示访客（自动创建） */
  isMaster?: boolean
}

/** Store shape persisted at ~/.dsh/im-channel/bindings.json. */
interface BindStoreFile {
  bindings: Binding[]
}

function storePath(): string {
  return join(homedir(), '.dsh', 'im-channel', 'bindings.json')
}

function readStore(): BindStoreFile {
  const path = storePath()
  if (!existsSync(path)) return { bindings: [] }
  return JSON.parse(readFileSync(path, 'utf8')) as BindStoreFile
}

function writeStore(store: BindStoreFile): void {
  const path = storePath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}

/** Debounce window for persisting mutations; reads stay in-memory after load. */
const FLUSH_DELAY_MS = 400

/**
 * Binding store with an in-memory cache and debounced persistence. All
 * mutations go through this class so concurrent message handling cannot
 * interleave read-modify-write cycles on the file. A process-shared
 * singleton keeps the login HTTP API and the router on the same cache.
 */
export class BindStore {
  private cache: Binding[] | undefined
  private flushTimer: NodeJS.Timeout | undefined
  /** Whether this process has wired a shutdown hook for pending flushes. */
  private static shutdownRegistered = false

  /** The process-wide store; the router and login API must share one cache. */
  static readonly shared = new BindStore()

  constructor() {
    // Persist debounced mutations when the process is asked to exit cleanly.
    // beforeExit fires once the event loop drains; combined with flushTimer's
    // unref() above, no handler keeps the loop alive on its own. Idempotent
    // across the multiple instances tests construct.
    if (!BindStore.shutdownRegistered) {
      BindStore.shutdownRegistered = true
      const flushOnExit = (): void => { BindStore.shared.flushSync() }
      process.once('beforeExit', flushOnExit)
      // SIGTERM is what systemd / Docker send; SIGINT is what ^C sends.
      // beforeExit may not fire if something else keeps the loop busy.
      process.once('SIGTERM', flushOnExit)
      process.once('SIGINT', flushOnExit)
    }
  }

  /** Loaded rows (lazily read from disk once per process). */
  private rows(): Binding[] {
    if (this.cache === undefined) this.cache = readStore().bindings
    return this.cache
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      try {
        if (this.cache !== undefined) writeStore({ bindings: this.cache })
      } catch {
        // Best-effort persistence; the in-memory rows stay authoritative.
      }
    }, FLUSH_DELAY_MS)
    this.flushTimer.unref?.()
  }

  /** Flush pending mutations now (used by tests and shutdown paths). */
  flushSync(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer)
      this.flushTimer = undefined
    }
    if (this.cache !== undefined) writeStore({ bindings: this.cache })
  }

  private findRow(ref: ImUserRef): Binding | undefined {
    return this.rows().find(row => row.kind === ref.kind && row.userId === ref.userId)
  }

  /** Bind an IM user to a harness session. Rebinding replaces the old row. */
  bind(ref: ImUserRef, sessionId: string, isMaster?: boolean): void {
    const existing = this.findRow(ref)
    if (existing !== undefined) {
      existing.sessionId = sessionId
      existing.boundAt = new Date().toISOString()
      if (isMaster !== undefined) existing.isMaster = isMaster
    } else {
      this.rows().push({
        kind: ref.kind,
        userId: ref.userId,
        sessionId,
        boundAt: new Date().toISOString(),
        ...(isMaster ? { isMaster: true } : {}),
      })
    }
    this.scheduleFlush()
  }

  /** Look up the bound session id for an IM user. */
  sessionIdFor(ref: ImUserRef): string | undefined {
    return this.findRow(ref)?.sessionId
  }

  /** 检查用户是否为主人（通过 /bind 绑定） */
  isMasterFor(ref: ImUserRef): boolean {
    return this.findRow(ref)?.isMaster === true
  }

  /** Remove a binding. Returns true when a row was removed. */
  unbind(ref: ImUserRef): boolean {
    const index = this.rows().findIndex(row => row.kind === ref.kind && row.userId === ref.userId)
    if (index < 0) return false
    this.rows().splice(index, 1)
    this.scheduleFlush()
    return true
  }

  /** Cycle the per-user reply verbosity 简洁 → 标准 → 详细 → 简洁. */
  cycleVerbosity(ref: ImUserRef): string {
    const order: Array<Binding['verbosity']> = ['简洁', '标准', '详细']
    const row = this.findRow(ref)
    const current = order.indexOf(row?.verbosity ?? '标准')
    const next = order[(current + 1) % order.length] ?? '标准'
    if (row !== undefined) {
      row.verbosity = next
      this.scheduleFlush()
    }
    return next
  }

  /** Read the user's current reply verbosity (default 标准). */
  verbosityFor(ref: ImUserRef): string {
    return this.findRow(ref)?.verbosity ?? '标准'
  }

  /** Set the user's reply verbosity directly (/回复 详细). */
  setVerbosity(ref: ImUserRef, level: '简洁' | '标准' | '详细'): void {
    const row = this.findRow(ref)
    if (row === undefined) return
    row.verbosity = level
    this.scheduleFlush()
  }

  /** Remember the user's workspace choice for future sessions. */
  selectWorkspace(ref: ImUserRef, path: string): void {
    const row = this.findRow(ref)
    if (row === undefined) return
    row.workspace = path
    this.scheduleFlush()
  }

  /** The user's chosen workspace path, if any. */
  workspaceFor(ref: ImUserRef): string | undefined {
    return this.findRow(ref)?.workspace
  }

  /** Remember where to reach the user (chat_id / user id) for proactive sends. */
  rememberTarget(ref: ImUserRef, targetId: string): void {
    const row = this.findRow(ref)
    if (row === undefined || row.lastTargetId === targetId) return
    row.lastTargetId = targetId
    this.scheduleFlush()
  }

  /** The user's last known chat target, if any. */
  targetIdFor(ref: ImUserRef): string | undefined {
    return this.findRow(ref)?.lastTargetId
  }

  /** Internal rows access for the module-level status/remove helpers. */
  rowsForListing(): readonly Binding[] {
    return this.rows()
  }

  /** Remove the row at an index obtained from rowsForListing(). */
  removeAt(index: number): void {
    this.rows().splice(index, 1)
    this.scheduleFlush()
  }
}

/** List all persisted binding rows (for status surfaces). */
export function listBindings(): Array<{ kind: string; boundAt: string; sessionId: string }> {
  return BindStore.shared.rowsForListing().map(row => ({ kind: row.kind, boundAt: row.boundAt, sessionId: row.sessionId }))
}

/** Remove a binding by loose match (kind+userId, or sessionId alone). Returns true when a row was removed. */
export function removeBinding(match: { kind?: string; userId?: string; sessionId?: string }): boolean {
  const store = BindStore.shared
  const rows = store.rowsForListing()
  const index = rows.findIndex(row =>
    (match.kind !== undefined && match.userId !== undefined && row.kind === match.kind && row.userId === match.userId)
    || (match.sessionId !== undefined && row.sessionId === match.sessionId))
  if (index < 0) return false
  store.removeAt(index)
  return true
}
