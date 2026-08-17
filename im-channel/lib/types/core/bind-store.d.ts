import type { ImUserRef } from './channel.ts';
/** Mapping row: one IM user bound to one harness session id. */
export interface Binding {
    readonly kind: ImUserRef['kind'];
    readonly userId: string;
    /** Harness session id the IM user chats through. */
    sessionId: string;
    boundAt: string;
    /** Reply verbosity preference (/回复): '简洁' | '标准' | '详细'. */
    verbosity?: '简洁' | '标准' | '详细';
    /** Workspace path chosen via /项目; new sessions start here. */
    workspace?: string;
    /** Last chat target the user wrote from (Feishu chat_id, ...); enables proactive sends after restarts. */
    lastTargetId?: string;
    /** 是否为主人（通过 /bind 绑定），false 或 undefined 表示访客（自动创建） */
    isMaster?: boolean;
}
/**
 * Binding store with an in-memory cache and debounced persistence. All
 * mutations go through this class so concurrent message handling cannot
 * interleave read-modify-write cycles on the file. A process-shared
 * singleton keeps the login HTTP API and the router on the same cache.
 */
export declare class BindStore {
    private cache;
    private flushTimer;
    /** Whether this process has wired a shutdown hook for pending flushes. */
    private static shutdownRegistered;
    /** The process-wide store; the router and login API must share one cache. */
    static readonly shared: BindStore;
    constructor();
    /** Loaded rows (lazily read from disk once per process). */
    private rows;
    /**
     * One-time migration for rows created before the digital-avatar model: a
     * channel whose only rows predate isMaster would look unowned and strand
     * its users behind the setup hint. Promote the earliest binding of each
     * ownerless channel to owner.
     */
    private migrateLegacyOwners;
    private scheduleFlush;
    /** Flush pending mutations now (used by tests and shutdown paths). */
    flushSync(): void;
    private findRow;
    /** Bind an IM user to a harness session. Rebinding replaces the old row. */
    bind(ref: ImUserRef, sessionId: string, isMaster?: boolean): void;
    /** Look up the bound session id for an IM user. */
    sessionIdFor(ref: ImUserRef): string | undefined;
    /** 检查用户是否为主人（通过 /bind 绑定） */
    isMasterFor(ref: ImUserRef): boolean;
    /**
     * The channel owner (digital-avatar claimant): the first isMaster row of a
     * channel kind. Everyone else on that channel is a guest riding the
     * owner's session; undefined means the channel is uninitialized.
     */
    ownerFor(kind: ImUserRef['kind']): {
        userId: string;
        sessionId: string;
    } | undefined;
    /** Remove a binding. Returns true when a row was removed. */
    unbind(ref: ImUserRef): boolean;
    /** Cycle the per-user reply verbosity 简洁 → 标准 → 详细 → 简洁. */
    cycleVerbosity(ref: ImUserRef): string;
    /** Read the user's current reply verbosity (default 标准). */
    verbosityFor(ref: ImUserRef): string;
    /** Set the user's reply verbosity directly (/回复 详细). */
    setVerbosity(ref: ImUserRef, level: '简洁' | '标准' | '详细'): void;
    /** Remember the user's workspace choice for future sessions. */
    selectWorkspace(ref: ImUserRef, path: string): void;
    /** The user's chosen workspace path, if any. */
    workspaceFor(ref: ImUserRef): string | undefined;
    /** Remember where to reach the user (chat_id / user id) for proactive sends. */
    rememberTarget(ref: ImUserRef, targetId: string): void;
    /** The user's last known chat target, if any. */
    targetIdFor(ref: ImUserRef): string | undefined;
    /** Internal rows access for the module-level status/remove helpers. */
    rowsForListing(): readonly Binding[];
    /** Remove the row at an index obtained from rowsForListing(). */
    removeAt(index: number): void;
}
/** List all persisted binding rows (for status surfaces). */
export declare function listBindings(): Array<{
    kind: string;
    boundAt: string;
    sessionId: string;
}>;
/** Remove a binding by loose match (kind+userId, or sessionId alone). Returns true when a row was removed. */
export declare function removeBinding(match: {
    kind?: string;
    userId?: string;
    sessionId?: string;
}): boolean;
