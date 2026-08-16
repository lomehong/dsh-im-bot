import type { Context } from '@deepseek-ai/cordis';
import type { AgentOptions } from '@deepseek-ai/dsh-agent';
import type { AgentDriver, PromptOptions } from '../core/router.ts';
/**
 * AgentDriver over the in-process harness services: one agent per bound IM
 * user, prompt via followup + whenIdle, replies assembled from
 * assistant/message events on the owned session. Modeled on the ACP bridge's
 * inflight-slot pattern (packages/acp/acp/src/index.ts).
 */
export declare class HarnessDriver implements AgentDriver {
    private readonly ctx;
    private readonly options;
    private readonly agents;
    /** Agents created by this driver, keyed by session id. */
    private readonly owned;
    private static nextInstanceId;
    private readonly instanceId;
    constructor(ctx: Context, options?: {
        cwd?: string;
        agentOptions?: AgentOptions;
    });
    startSession(options?: {
        cwd?: string;
    }): Promise<string>;
    /** Whether this driver currently owns a live agent for the session id. */
    has(sessionId: string): boolean;
    /**
     * Re-attach to a persisted session after a host restart. Bindings outlive
     * the process; agents.resume loads the stored history (the session's
     * original cwd/meta come from persistence) and re-composes the agent
     * world through the same preset setup as create.
     */
    resumeSession(sessionId: string, _options?: {
        cwd?: string;
    }): Promise<string>;
    /** Create (or resume) an agent with the gateway-equivalent composition. */
    private createAgent;
    /** Group the session under the workspace owning its cwd, when registered. */
    private attachWorkspace;
    /** Cancel the in-flight turn of a session; false when idle or unknown. */
    cancel(sessionId: string): boolean;
    prompt(sessionId: string, text: string, options?: PromptOptions): Promise<string>;
    /** Push the current turn view to the live sink, skipping no-op renders. */
    private emitView;
    /** Resolve/reject a turn exactly once and clear its slot. */
    private endTurn;
}
