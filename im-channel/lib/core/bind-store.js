import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
function storePath() {
    return join(homedir(), '.dsh', 'im-channel', 'bindings.json');
}
function readStore() {
    const path = storePath();
    if (!existsSync(path))
        return { bindings: [] };
    return JSON.parse(readFileSync(path, 'utf8'));
}
function writeStore(store) {
    const path = storePath();
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}
/** Debounce window for persisting mutations; reads stay in-memory after load. */
const FLUSH_DELAY_MS = 400;
/**
 * Binding store with an in-memory cache and debounced persistence. All
 * mutations go through this class so concurrent message handling cannot
 * interleave read-modify-write cycles on the file. A process-shared
 * singleton keeps the login HTTP API and the router on the same cache.
 */
export class BindStore {
    cache;
    flushTimer;
    /** Whether this process has wired a shutdown hook for pending flushes. */
    static shutdownRegistered = false;
    /** The process-wide store; the router and login API must share one cache. */
    static shared = new BindStore();
    constructor() {
        // Persist debounced mutations when the process is asked to exit cleanly.
        // beforeExit fires once the event loop drains; combined with flushTimer's
        // unref() above, no handler keeps the loop alive on its own. Idempotent
        // across the multiple instances tests construct.
        if (!BindStore.shutdownRegistered) {
            BindStore.shutdownRegistered = true;
            const flushOnExit = () => { BindStore.shared.flushSync(); };
            process.once('beforeExit', flushOnExit);
            // SIGTERM is what systemd / Docker send; SIGINT is what ^C sends.
            // beforeExit may not fire if something else keeps the loop busy.
            process.once('SIGTERM', flushOnExit);
            process.once('SIGINT', flushOnExit);
        }
    }
    /** Loaded rows (lazily read from disk once per process). */
    rows() {
        if (this.cache === undefined)
            this.cache = readStore().bindings;
        return this.cache;
    }
    scheduleFlush() {
        if (this.flushTimer !== undefined)
            return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = undefined;
            try {
                if (this.cache !== undefined)
                    writeStore({ bindings: this.cache });
            }
            catch {
                // Best-effort persistence; the in-memory rows stay authoritative.
            }
        }, FLUSH_DELAY_MS);
        this.flushTimer.unref?.();
    }
    /** Flush pending mutations now (used by tests and shutdown paths). */
    flushSync() {
        if (this.flushTimer !== undefined) {
            clearTimeout(this.flushTimer);
            this.flushTimer = undefined;
        }
        if (this.cache !== undefined)
            writeStore({ bindings: this.cache });
    }
    findRow(ref) {
        return this.rows().find(row => row.kind === ref.kind && row.userId === ref.userId);
    }
    /** Bind an IM user to a harness session. Rebinding replaces the old row. */
    bind(ref, sessionId) {
        const existing = this.findRow(ref);
        if (existing !== undefined) {
            existing.sessionId = sessionId;
            existing.boundAt = new Date().toISOString();
        }
        else {
            this.rows().push({
                kind: ref.kind,
                userId: ref.userId,
                sessionId,
                boundAt: new Date().toISOString(),
            });
        }
        this.scheduleFlush();
    }
    /** Look up the bound session id for an IM user. */
    sessionIdFor(ref) {
        return this.findRow(ref)?.sessionId;
    }
    /** Remove a binding. Returns true when a row was removed. */
    unbind(ref) {
        const index = this.rows().findIndex(row => row.kind === ref.kind && row.userId === ref.userId);
        if (index < 0)
            return false;
        this.rows().splice(index, 1);
        this.scheduleFlush();
        return true;
    }
    /** Cycle the per-user reply verbosity 简洁 → 标准 → 详细 → 简洁. */
    cycleVerbosity(ref) {
        const order = ['简洁', '标准', '详细'];
        const row = this.findRow(ref);
        const current = order.indexOf(row?.verbosity ?? '标准');
        const next = order[(current + 1) % order.length] ?? '标准';
        if (row !== undefined) {
            row.verbosity = next;
            this.scheduleFlush();
        }
        return next;
    }
    /** Read the user's current reply verbosity (default 标准). */
    verbosityFor(ref) {
        return this.findRow(ref)?.verbosity ?? '标准';
    }
    /** Set the user's reply verbosity directly (/回复 详细). */
    setVerbosity(ref, level) {
        const row = this.findRow(ref);
        if (row === undefined)
            return;
        row.verbosity = level;
        this.scheduleFlush();
    }
    /** Remember the user's workspace choice for future sessions. */
    selectWorkspace(ref, path) {
        const row = this.findRow(ref);
        if (row === undefined)
            return;
        row.workspace = path;
        this.scheduleFlush();
    }
    /** The user's chosen workspace path, if any. */
    workspaceFor(ref) {
        return this.findRow(ref)?.workspace;
    }
    /** Remember where to reach the user (chat_id / user id) for proactive sends. */
    rememberTarget(ref, targetId) {
        const row = this.findRow(ref);
        if (row === undefined || row.lastTargetId === targetId)
            return;
        row.lastTargetId = targetId;
        this.scheduleFlush();
    }
    /** The user's last known chat target, if any. */
    targetIdFor(ref) {
        return this.findRow(ref)?.lastTargetId;
    }
    /** Internal rows access for the module-level status/remove helpers. */
    rowsForListing() {
        return this.rows();
    }
    /** Remove the row at an index obtained from rowsForListing(). */
    removeAt(index) {
        this.rows().splice(index, 1);
        this.scheduleFlush();
    }
}
/** List all persisted binding rows (for status surfaces). */
export function listBindings() {
    return BindStore.shared.rowsForListing().map(row => ({ kind: row.kind, boundAt: row.boundAt, sessionId: row.sessionId }));
}
/** Remove a binding by loose match (kind+userId, or sessionId alone). Returns true when a row was removed. */
export function removeBinding(match) {
    const store = BindStore.shared;
    const rows = store.rowsForListing();
    const index = rows.findIndex(row => (match.kind !== undefined && match.userId !== undefined && row.kind === match.kind && row.userId === match.userId)
        || (match.sessionId !== undefined && row.sessionId === match.sessionId));
    if (index < 0)
        return false;
    store.removeAt(index);
    return true;
}
