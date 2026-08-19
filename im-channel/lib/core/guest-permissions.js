/**
 * Guest permission policy for the digital-avatar model: the owner claims the
 * channel's avatar via /bind; everyone else talks to it as a guest. Guests
 * share the owner's session but may only use the tools and commands the
 * owner explicitly allows here.
 */
/** Commands a guest may run, by canonical command id (see router COMMAND_ALIASES). */
export const DEFAULT_GUEST_COMMANDS = ['帮助', '状态', '回复', '停止', '全文'];
/**
 * Curated tool catalog for the settings UI. `pattern` is what goes into the
 * guestTools allowlist: an exact tool name or a trailing-`*` prefix pattern
 * (e.g. `fs*` covers the fs tool family, `mcp__wecom*` an MCP namespace).
 * `risky` marks capabilities that can act on the owner's machine.
 */
export const GUEST_TOOL_CATALOG = [
    { pattern: 'web*', label: '联网搜索 / 抓取网页', risky: false },
    { pattern: 'todo*', label: '任务清单管理', risky: false },
    { pattern: 'session_search', label: '搜索历史会话记录', risky: false },
    { pattern: 'ask_user_question', label: '向用户提问确认', risky: false },
    { pattern: 'fs*', label: '读取项目文件', risky: true },
    { pattern: 'str_replace_editor', label: '编辑项目文件', risky: true },
    { pattern: 'lsp*', label: '代码语言服务（跳转/诊断）', risky: true },
    { pattern: 'skill', label: '运行技能', risky: true },
    { pattern: 'bash', label: '执行 Shell 命令', risky: true },
    { pattern: 'pwsh', label: '执行 PowerShell', risky: true },
    { pattern: 'subagent*', label: '派生子代理（继承工具能力，谨慎开放）', risky: true },
];
/** Canonical guest-facing commands for the settings UI checkboxes. */
export const GUEST_COMMAND_CATALOG = [
    { id: '帮助', label: '/帮助 查看命令列表' },
    { id: '状态', label: '/状态 查看当前状态' },
    { id: '回复', label: '/回复 调整个人消息详细度' },
    { id: '停止', label: '/停止 中断当前任务' },
    { id: '全文', label: '/全文 查看被截断长回复的全文' },
];
/**
 * Whether a tool name is allowed by a pattern list. Exact names match
 * verbatim; a trailing `*` matches by prefix (tool families, MCP namespaces).
 */
export function matchesToolPattern(name, patterns) {
    for (const pattern of patterns) {
        if (pattern.endsWith('*')) {
            if (name.startsWith(pattern.slice(0, -1)))
                return true;
        }
        else if (pattern === name) {
            return true;
        }
    }
    return false;
}
/** Denial reason returned by the tools guard; model-facing Chinese text. */
export function guestToolDenied(toolName) {
    return `访客模式无权使用工具 ${toolName}。请直接以对话方式回答用户；如确实需要该工具，请提示用户联系 Owner 在「设置 → 插件 → 手机连接 → 访客权限」中开放。`;
}
