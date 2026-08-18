import type { ImChannel, InboundMessage } from './channel.ts';
/**
 * Harness-side conversation driver implemented by the plugin glue that
 * talks to the agent services. Channels never see this; the router owns it.
 */
export interface AgentDriver {
    /** Create a new session (or resume) and return its id. */
    startSession(options?: SessionOptions): Promise<string>;
    /** Whether this driver currently owns a live agent for the session id. */
    has?(sessionId: string): boolean;
    /**
     * Re-attach to a persisted session after a host restart (bindings outlive
     * the process). Throws when the session cannot be resurrected.
     */
    resumeSession?(sessionId: string, options?: SessionOptions): Promise<string>;
    /**
     * Send a user message into a session and await the assistant's final
     * reply. While the turn runs, onUpdate fires with full snapshots of the
     * turn so far (already filtered to the caller's verbosity), letting the
     * router stream progress to the channel instead of going silent.
     */
    prompt(sessionId: string, text: string, options?: PromptOptions): Promise<string>;
}
export interface PromptOptions {
    verbosity?: string;
    /** Live progress sink: full snapshot of the turn so far, verbosity-filtered. */
    onUpdate?(view: string): void;
    /** Who initiated the turn: the channel owner or a guest (drives tool gating). */
    actor?: 'owner' | 'guest';
}
/** Per-session knobs a /新建 or /bind session can carry. */
export interface SessionOptions {
    provider?: string;
    model?: string;
    cwd?: string;
    /** 当前用户 ID（用于共享记忆权限过滤） */
    userId?: string;
    /** 是否为绑定主人 */
    isMaster?: boolean;
}
/** Status facts the /状态 command renders. */
export interface RouterStatus {
    cwd: string;
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** One selectable workspace for /项目. */
export interface WorkspaceChoice {
    path: string;
    title: string;
}
/** One selectable model for /模型. */
export interface ModelChoice {
    provider: string;
    model: string;
    label: string;
}
/** Router configuration knobs. */
export interface RouterConfig {
    /** Slash command prefix; inbound text starting with it routes to commands. */
    commandPrefix: string;
}
export interface RouterDeps {
    readonly channels: readonly ImChannel[];
    readonly driver: AgentDriver;
    readonly store: BindStoreLike;
    readonly config?: Partial<RouterConfig>;
    /** Live status facts for /状态; absent falls back to a minimal reply. */
    readonly status?: () => RouterStatus;
    /** List selectable workspaces for /项目; absent lists nothing. */
    readonly workspaces?: () => WorkspaceChoice[];
    /** List selectable models for /模型; absent lists nothing. */
    readonly models?: () => ModelChoice[] | Promise<ModelChoice[]>;
    /** Cancel the in-flight turn for a session (/停止); optional. */
    readonly cancel?: (sessionId: string) => boolean;
    /** Change the harness-wide default model (/模型, /思考); absent = read-only. */
    readonly setDefaultModel?: (patch: {
        provider?: string;
        model?: string;
        reasoningEffort?: string;
    }) => Promise<void>;
    /** Effort levels the current model supports (/思考); absent or empty = only raw ids. */
    readonly efforts?: () => Array<{
        id: string;
        name: string;
    }> | Promise<Array<{
        id: string;
        name: string;
    }>>;
    /** Commands a guest may run (canonical ids); absent = DEFAULT_GUEST_COMMANDS. */
    readonly guestCommands?: () => readonly string[];
    /** Diagnostic sink (wired to the host logger); absent = silent. */
    readonly log?: (line: string) => void;
    /**
     * Access gate consulted for every inbound message; absent = everyone
     * allowed. Rejected senders are ignored silently (no probe surface).
     */
    readonly allowed?: (from: InboundMessage['from']) => boolean;
}
/** BindStore surface the router needs (subset of BindStore for testing). */
export interface BindStoreLike {
    bind(ref: InboundMessage['from'], sessionId: string, isMaster?: boolean): void;
    sessionIdFor(ref: InboundMessage['from']): string | undefined;
    isMasterFor?(ref: InboundMessage['from']): boolean;
    /**
     * The channel owner (first isMaster row per channel kind) whose session is
     * the digital avatar everyone else rides; undefined = channel uninitialized.
     */
    ownerFor?(kind: InboundMessage['from']['kind']): {
        userId: string;
        sessionId: string;
    } | undefined;
    unbind(ref: InboundMessage['from']): boolean;
    /** Cycle the per-user reply verbosity (/回复); optional. */
    cycleVerbosity?(ref: InboundMessage['from']): string | undefined;
    /** Read the per-user reply verbosity; optional (defaults to 标准). */
    verbosityFor?(ref: InboundMessage['from']): string | undefined;
    /** Set the per-user reply verbosity directly; optional. */
    setVerbosity?(ref: InboundMessage['from'], level: '简洁' | '标准' | '详细'): void;
    /** Remember the user's chosen workspace path (/项目 N); optional. */
    selectWorkspace?(ref: InboundMessage['from'], path: string): void;
    /** The user's chosen workspace path, if any; optional. */
    workspaceFor?(ref: InboundMessage['from']): string | undefined;
    /** Remember where to reach the user for proactive sends; optional. */
    rememberTarget?(ref: InboundMessage['from'], targetId: string): void;
}
export declare class Router {
    private readonly deps;
    private readonly commandPrefix;
    /** Start a session honoring the user's stored workspace, if any. */
    private startUserSession;
    /** The wired channels (readonly view for topology reconciliation). */
    readonly channels: readonly ImChannel[];
    constructor(deps: RouterDeps);
    private log;
    /** Wire all channels' inbound handlers to routeMessage and connect them. */
    start(): Promise<void>;
    stop(): Promise<void>;
    /** channel.send that can never reject into an unhandled rejection. */
    private safeSend;
    /** Open a live turn sink, falling back to send-on-final when unsupported. */
    private openSink;
    /** Route one inbound message: commands first, then bound-session chat. */
    private routeMessage;
    /**
     * Prompt the owner's avatar session (resuming it after host restarts) and
     * stream the reply back, whether the actor is the owner or a guest.
     */
    private promptAvatarSession;
    /**
     * Prompt a guest session (resuming after host restart) and stream the reply.
     * Each guest has their own independent session.
     */
    private promptSession;
    /** 处理已绑定的会话消息：发送到 agent 并回复 */
    private handleBoundMessage;
    /** Handle slash commands (Chinese primary, English aliases). */
    private runCommand;
}
