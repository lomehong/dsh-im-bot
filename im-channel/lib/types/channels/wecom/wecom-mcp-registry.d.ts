/**
 * 企业微信 MCP 工具注册
 *
 * 将企业微信智能机器人提供的 MCP 工具注册到 DSH agent 的 tool 系统中，
 * 使 agent 可以直接调用企业微信的日程、待办、会议等能力。
 */
import type { Context } from '@deepseek-ai/cordis';
import { type McpServerConfig } from './mcp-client.ts';
/** 管理 MCP 工具注册 */
export declare class WecomMcpRegistry {
    private readonly mcpManager;
    /** 注册 MCP 服务器配置 */
    registerServer(config: McpServerConfig): void;
    /**
     * 从通用 MCP 服务器管理文件（mcp-servers.json）同步已启用的服务器。
     * 设置页新增/修改/删除服务器后无需重启即可在下一个 agent 会话生效。
     */
    syncFromServerFile(): void;
    /** 将 MCP 工具注册到 agent 上下文（每个 agent 独立注册） */
    registerToAgent(agentCtx: Context): Promise<void>;
    private log;
}
