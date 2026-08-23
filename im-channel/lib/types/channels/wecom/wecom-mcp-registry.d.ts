/**
 * MCP 工具注册
 *
 * 将通用 MCP 服务器提供的工具注册到 DSH agent 的 tool 系统中，
 * 使 agent 可以直接调用。模型可见的工具名统一采用官方约定
 * `mcp__<serverName>__<rawName>`（与 DSH 官方 dsh-mcp-client 一致），
 * 便于按前缀做访客权限白名单（如 `mcp__wecom*` 放行整个命名空间）。
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
