/**
 * Turn-rendering policy shared by the driver and router: how collected
 * assistant messages and tool lines become (a) the live progress view
 * pushed to channel sinks and (b) the settled final reply, at each /回复
 * verbosity level.
 */

/** Live-update cadence derived from the /回复 verbosity. */
export type VerbosityMode = 'quiet' | 'normal' | 'verbose'

/** /回复 verbosity → live-update mode. */
export function modeOf(verbosity: string | undefined): VerbosityMode {
  if (verbosity === '简洁') return 'quiet'
  if (verbosity === '详细') return 'verbose'
  return 'normal'
}

/** Prefix note added when a newer prompt interrupted the turn. */
export function interruptedNote(partial: string): string {
  if (partial.length === 0) return '⏹ 本轮已被新消息中断。'
  return `⏹ 本轮已被新消息中断，以下为未完成的部分：\n\n${partial}`
}

/**
 * Render one finished turn's collected output at the user's verbosity level:
 * quiet = only the LAST assistant text message; normal = every assistant
 * text message; verbose = tool calls/results plus every assistant text
 * message.
 */
export function renderFinal(mode: VerbosityMode, messages: readonly string[], toolLines: readonly string[]): string {
  if (mode === 'quiet') return messages.at(-1) ?? ''
  if (mode === 'verbose') {
    const parts: string[] = []
    if (toolLines.length > 0) parts.push(toolLines.join('\n'), '──────────')
    parts.push(...messages)
    return parts.join('\n')
  }
  return messages.join('\n\n')
}

/**
 * Render the in-progress view pushed to live sinks. quiet hides content and
 * only tracks activity; normal/verbose mirror the final rendering so the
 * settled message is a natural continuation of what already streamed. The
 * partial carries the unfinalized tail assembled from assistant/chunk
 * text-delta events, so the view types out while the model generates.
 */
export function renderLive(mode: VerbosityMode, messages: readonly string[], toolLines: readonly string[], toolCount: number, partial = ''): string {
  if (mode === 'quiet') {
    return toolCount > 0 ? `⏳ 处理中，已执行 ${toolCount} 次工具调用…` : '⏳ 已收到，正在处理…'
  }
  if (mode === 'verbose') {
    const parts: string[] = []
    if (toolLines.length > 0) parts.push(toolLines.join('\n'), '──────────')
    const text = liveText(messages, partial)
    parts.push(text.length > 0 ? text : '⏳ 正在思考…')
    return parts.join('\n')
  }
  const text = liveText(messages, partial)
  if (text.length > 0) return text
  return toolCount > 0 ? `⏳ 正在执行任务（已调用 ${toolCount} 次工具）…` : '⏳ 正在思考…'
}

/** Finalized message segments plus the streaming tail of the next one. */
function liveText(messages: readonly string[], partial: string): string {
  const segments = partial.length > 0 ? [...messages, partial] : messages
  return segments.join('\n\n')
}
