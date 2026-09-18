import type { DriverEvent, DriverRateLimit } from 'agent-driver'
import type { ChoiceOption, FrameworkEvent } from './events.js'

// The terminal surface for the agent's event stream: render one {@link FrameworkEvent} as one
// human-readable line. This is the CLI's counterpart to the dashboard's read-model
// projections (run-view.ts) — a pure formatter over the same union, kept out of events.ts so
// the event contract stays a plain data module (and browser-safe for the client bundle).

/** Render a {@link FrameworkEvent} as one human-readable line (terminal surface). */
export function formatFrameworkEvent(event: FrameworkEvent): string {
  switch (event.kind) {
    case 'session':
      return `◆ ${event.fake ? 'fake' : event.driver}${event.model ? ` (${event.model})` : ''} in ${event.workspace}${
        event.sessionLink ? ` — ${event.sessionLink}` : ''
      }`
    case 'session-update':
      return `  session ${event.sessionId}${event.sessionLink ? ` — ${event.sessionLink}` : ''}`
    case 'usage': {
      const turns = `over ${event.turns} turn${event.turns === 1 ? '' : 's'}`
      // No price to show: report the tokens the agent *did* report, rather than a
      // `$0.0000` that would read as free (#540).
      if (event.costUsd === undefined) {
        const tokens = event.inputTokens + event.cacheReadTokens + event.outputTokens
        return `  tokens: ${tokens.toLocaleString('en-US')} (${event.outputTokens.toLocaleString('en-US')} out) ${turns} — no price reported`
      }
      return `  spend: $${event.costUsd.toFixed(4)} ${turns}`
    }
    case 'choice': {
      const mark = (o: ChoiceOption) =>
        event.multi ? (o.default ? '[x]' : '[ ]') : o.id === event.recommended ? '●' : '○'
      const opts = event.options.map(o => `    ${mark(o)} ${o.label}`).join('\n')
      return `? ${event.title}\n${opts}`
    }
    case 'driver':
      return formatDriverEvent(event.event)
    case 'end':
      if (event.ok) return '✓ finished'
      if (event.stopped) return '■ stopped'
      if (event.waiting) return '? waiting for an answer'
      return `✗ failed: ${event.detail ?? 'unknown error'}`
  }
}

function formatDriverEvent(event: DriverEvent): string {
  switch (event.type) {
    case 'start':
      return `  › prompt: ${truncate(event.prompt, 140)}`
    // Normally consumed by telemetry before it reaches a stream (#1322); rendered anyway so a
    // stray one reads as what it is rather than crashing the formatter.
    case 'session':
      return `  session ${event.sessionId}`
    case 'text':
      return `    ${truncate(event.text)}`
    case 'action':
      return `    · ${event.label}`
    case 'result':
      return `  ‹ turn complete`
    case 'rate-limit':
      return `    ${formatRateLimit(event.limit)}`
    case 'error':
      return `  ! agent error: ${event.message}`
    case 'notice':
      return `  ~ ${event.message}`
    case 'question':
      return `  ? ${truncate(event.question.title, 140)}`
  }
}

/** Quiet on the happy path: only worth a line when the quota is actually tight. */
function formatRateLimit(limit: DriverRateLimit): string {
  const resets = new Date(limit.resetsAt).toISOString()
  if (limit.status === 'rejected') return `✗ quota exhausted (${limit.window}), resets ${resets}`
  if (limit.status === 'allowed_warning') return `! quota running low (${limit.window}), resets ${resets}`
  return `· quota ${limit.status} (${limit.window}), resets ${resets}`
}

function truncate(text: string, max = 100): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}
