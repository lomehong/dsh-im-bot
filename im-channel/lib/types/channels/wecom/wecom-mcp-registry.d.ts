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
    private registered;
    /** 注册 MCP 服务器配置 */
    registerServer(config: McpServerConfig): void;
    /** 将 MCP 工具注册到 agent 上下文 */
    registerToAgent(agentCtx: Context): Promise<void>;
    private log;
}
