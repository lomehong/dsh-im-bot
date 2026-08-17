import type { Context } from '@deepseek-ai/cordis';
import type { AgentOptions } from '@deepseek-ai/dsh-agent';
import type { AgentDriver, PromptOptions } from '../core/router.ts';
import type { WecomMcpRegistry } from '../channels/wecom/wecom-mcp-registry.ts';
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
    /** MCP 工具注册表（企业微信） */
    private readonly mcpRegistry;
    /** 访客工具白名单（设置实时读取）；决定 tools.guard 是否放行当前轮的工具调用 */
    private readonly guestTools;
    /** 当前轮发起者（owner/guest），按会话记录，供 tools.guard 查询 */
    private readonly turnActors;
    private static nextInstanceId;
    private readonly instanceId;
    constructor(ctx: Context, options?: {
        cwd?: string;
        agentOptions?: AgentOptions;
        mcpRegistry?: WecomMcpRegistry;
        guestTools?: () => readonly string[];
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
    /**
     * Register the guest tool gate on one agent's scoped context: a monotonic
     * guard (deny-only, ordering cannot re-allow) that blocks tool calls during
     * guest-initiated turns unless the tool matches the owner-configured
     * guestTools allowlist. Owner turns pass through untouched. The guard's
     * layer is bound to the agent's context, so it disposes with the agent.
     */
    private mountGuestGuard;
    private attachWorkspace;
    /** Cancel the in-flight turn of a session; false when idle or unknown. */
    cancel(sessionId: string): boolean;
    prompt(sessionId: string, text: string, options?: PromptOptions): Promise<string>;
    /** Push the current turn view to the live sink, skipping no-op renders. */
    private emitView;
    /** Resolve/reject a turn exactly once and clear its slot. */
    private endTurn;
}
