import type { Context } from '@deepseek-ai/cordis';
import type { AgentOptions } from '@deepseek-ai/dsh-agent';
import type { AgentDriver, PromptOptions, SessionOptions } from '../core/router.ts';
import type { QuestionAnswer, QuestionItem } from './question-bridge.ts';
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
    /** 当前轮发起者信息（角色 + userId），按会话记录；工具守卫/审批按此归因 */
    private readonly turnInfos;
    /** 无 inflight 轮次时的定稿输出缓冲（去抖后主动推送）。 */
    private readonly backgroundBuffer;
    private static nextInstanceId;
    private readonly instanceId;
    constructor(ctx: Context, options?: {
        cwd?: string;
        agentOptions?: AgentOptions;
        mcpRegistry?: WecomMcpRegistry;
        guestTools?: () => readonly string[];
        /** 访客工具审批：把决策交给插件层（推卡片给 Owner、等待 IM 回复）。 */
        onOwnerApproval?: (info: {
            sessionId: string;
            toolName: string;
            reason: string | undefined;
            guestUserId: string | undefined;
            isOwnerTrigger: boolean;
        }) => Promise<'allowed-once' | 'rejected'> | undefined;
        /** 非本插件驱动轮次的定稿输出（schedule/yuyi 唤醒、竞态尾巴）→ 主动推送 IM。 */
        onBackgroundMessage?: (sessionId: string, text: string) => void;
        /** ask_user_question 的 IM 桥：agent 作用域遮蔽同名工具，问题推给绑定用户。 */
        onUserQuestion?: (sessionId: string, questions: QuestionItem[]) => Promise<QuestionAnswer>;
    });
    startSession(options?: SessionOptions): Promise<string>;
    /** Whether this driver currently owns a live agent for the session id. */
    has(sessionId: string): boolean;
    /**
     * Re-attach to a persisted session after a host restart. Bindings outlive
     * the process; agents.resume loads the stored history (the session's
     * original cwd/meta come from persistence) and re-composes the agent
     * world through the same preset setup as create.
     */
    resumeSession(sessionId: string, options?: SessionOptions): Promise<string>;
    /** Create (or resume) an agent with the gateway-equivalent composition. */
    private createAgent;
    /**
     * 归因工具调用的发起角色：沿 parentSession 链回溯到根会话（子代理
     * session.header.parentSession 指向父会话），再查 turnActors。深度上限
     * 防御环；中途 agent 不在注册表时按已知最外层计。
     */
    /** 沿 parentSession 链上溯到根，返回根会话绑定行的 userId（渠道 Owner 的 userId）。 */
    private ownerUserIdFor;
    private actorOfAgent;
    /**
     * P0 安全：外发 IM 前的敏感信息脱敏（masking 服务存在时）。流式视图与
     * 终稿统一走这里；服务不可用时原样返回。
     */
    private maskOutgoing;
    /** Token 用量快照（/状态 展示）；token-meter 服务缺席时返回 undefined。 */
    usageOf(sessionId: string): {
        totalTokens: number;
    } | undefined;
    /** 主动压缩会话（/压缩）；compaction 服务缺席或不适用时返回 false。 */
    compact(sessionId: string): Promise<boolean>;
    /** Group the session under the workspace owning its cwd, when registered. */
    private attachWorkspace;
    /**
     * 注入共享记忆服务（如果 dsh-memory 插件已加载）。
     * 先即时查询服务；若不可用（插件尚未加载/ACTIVE），用 ctx.inject 延迟注册——
     * dsh-memory 就绪后自动补注册工具，不再静默丢失。
     */
    private mountSharedMemory;
    /**
     * 注入共享记忆摘要到 agent 的上下文，让 agent 知道有记忆可以读取。
     * 使用 system 消息注入，在 agent 首次响应前提供记忆上下文。
     */
    private injectMemoryContext;
    /**
     * Steering: append instructions to the RUNNING turn without cancelling it
     * (contrast with prompt(), which interrupts first). False when idle — the
     * caller should tell the user to send a normal message instead.
     */
    steer(sessionId: string, text: string): boolean;
    /**
     * Install the approval waterfall hook on the plugin root context.
     * Decoupled from per-agent creation so Owner-driven escalate (e.g. a
     * sandbox approveEscalation inside an Owner session) is also captured.
     */
    installApprovalHook(): void;
    /** Cancel the in-flight turn of a session; false when idle or unknown. */
    cancel(sessionId: string): boolean;
    prompt(sessionId: string, text: string, options?: PromptOptions): Promise<string>;
    /** Push the current turn view to the live sink, skipping no-op renders. */
    private emitView;
    /**
     * 在 agent 作用域注册同名 ask_user_question 工具遮蔽全局实现：问题经
     * IM 桥推给该会话绑定用户，回复（选项序号/文字/自定义）即答案。作用
     * 域遮蔽只影响本 agent（含子孙），网页端会话不受影响；桥未注入或
     * 工具服务缺席时保持全局实现。
     */
    private mountAskUserTool;
    /** 无 inflight 轮次的定稿输出：3s 去抖合并后推送给绑定用户。 */
    private bufferBackgroundMessage;
    private armBackgroundFlush;
    /** Resolve/reject a turn exactly once and clear its slot. */
    private endTurn;
}
