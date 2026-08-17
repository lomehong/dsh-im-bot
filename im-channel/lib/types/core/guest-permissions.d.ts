/**
 * Guest permission policy for the digital-avatar model: the owner claims the
 * channel's avatar via /bind; everyone else talks to it as a guest. Guests
 * share the owner's session but may only use the tools and commands the
 * owner explicitly allows here.
 */
/** Commands a guest may run, by canonical command id (see router COMMAND_ALIASES). */
export declare const DEFAULT_GUEST_COMMANDS: readonly string[];
/**
 * Curated tool catalog for the settings UI. `pattern` is what goes into the
 * guestTools allowlist: an exact tool name or a trailing-`*` prefix pattern
 * (e.g. `fs*` covers the fs tool family, `mcp__wecom*` an MCP namespace).
 * `risky` marks capabilities that can act on the owner's machine.
 */
export declare const GUEST_TOOL_CATALOG: ReadonlyArray<{
    pattern: string;
    label: string;
    risky: boolean;
}>;
/** Canonical guest-facing commands for the settings UI checkboxes. */
export declare const GUEST_COMMAND_CATALOG: ReadonlyArray<{
    id: string;
    label: string;
}>;
/**
 * Whether a tool name is allowed by a pattern list. Exact names match
 * verbatim; a trailing `*` matches by prefix (tool families, MCP namespaces).
 */
export declare function matchesToolPattern(name: string, patterns: readonly string[]): boolean;
/** Denial reason returned by the tools guard; model-facing Chinese text. */
export declare function guestToolDenied(toolName: string): string;
