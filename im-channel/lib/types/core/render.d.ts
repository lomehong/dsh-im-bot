/**
 * Turn-rendering policy shared by the driver and router: how collected
 * assistant messages and tool lines become (a) the live progress view
 * pushed to channel sinks and (b) the settled final reply, at each /回复
 * verbosity level.
 */
/** Live-update cadence derived from the /回复 verbosity. */
export type VerbosityMode = 'quiet' | 'normal' | 'verbose';
/** /回复 verbosity → live-update mode. */
export declare function modeOf(verbosity: string | undefined): VerbosityMode;
/** Prefix note added when a newer prompt interrupted the turn. */
export declare function interruptedNote(partial: string): string;
/**
 * Render one finished turn's collected output at the user's verbosity level:
 * quiet = only the LAST assistant text message; normal = every assistant
 * text message; verbose = tool calls/results plus every assistant text
 * message.
 */
export declare function renderFinal(mode: VerbosityMode, messages: readonly string[], toolLines: readonly string[]): string;
/**
 * Render the in-progress view pushed to live sinks. quiet hides content and
 * only tracks activity; normal/verbose mirror the final rendering so the
 * settled message is a natural continuation of what already streamed. The
 * partial carries the unfinalized tail assembled from assistant/chunk
 * text-delta events, so the view types out while the model generates.
 */
export declare function renderLive(mode: VerbosityMode, messages: readonly string[], toolLines: readonly string[], toolCount: number, partial?: string): string;
