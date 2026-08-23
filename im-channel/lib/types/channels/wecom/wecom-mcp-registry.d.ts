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
    /** 全局注册产生的 disposer，供插件卸载/重载时清理 */
    private globalDisposers;
    /** 注册 MCP 服务器配置 */
    registerServer(config: McpServerConfig): void;
    /**
     * 从通用 MCP 服务器管理文件（mcp-servers.json）同步已启用的服务器。
     * 设置页新增/修改/删除服务器后无需重启即可在下一个 agent 会话生效。
     */
    syncFromServerFile(): void;
    /** 将 MCP 工具注册到 agent 上下文（每个 agent 独立注册） */
    registerToAgent(agentCtx: Context): Promise<void>;
    /**
     * 将 MCP 工具注册到全局 tools 服务（宿主根层），使**任何通道**创建的
     * agent 会话（Web / IM / headless / 子代理）都能看到这些工具。
     *
     * 工具名沿用官方 `mcp__<serverName>__<rawName>` 命名，server 前缀天然
     * 避免跨服务器重名；先清理上一代注册再持有新一代（重载安全）。
     */
    registerGlobal(rootCtx: Context): Promise<void>;
    /** 注销全部全局注册的 MCP 工具（插件卸载 / 重载时调用） */
    disposeGlobal(): void;
    /** 重载：注销旧注册后按最新配置重新全局注册（reload() 时调用） */
    resyncGlobal(rootCtx: Context): Promise<void>;
    /** 构造单个 MCP 工具的 ToolDefinition（per-agent 与全局注册共用） */
    private buildDefinition;
    private log;
}
