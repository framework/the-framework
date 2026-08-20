import type { FrameworkEvent } from '../../src/index.js'
import { sessionInfo, agentProgress } from '../../src/client.js'
import { agentStatusPill } from '../lib/agent-status.js'
import { describeSessionLink } from '../lib/session-link.js'
import { cn } from '../lib/utils.js'

// The agent overview (#431): the "moat" the wrapped agent's own chat cannot show, rebuilt
// on the new dashboard. Each card is a pure projection of the event stream (run-view.ts
// in @gemstack/the-framework) — the agent's status and a link
// to the live session. Cards render only when their data has arrived, so an early agent
// shows nothing extra.
export function AgentOverview({
  events,
}: {
  events: FrameworkEvent[]
}) {
  const session = sessionInfo(events)
  const progress = agentProgress(events)
  const status = agentStatusPill(events)

  // The "Open session" link, labeled honestly: a headless Claude Code run has no per-session
  // URL, so the generic app entry (claude.ai/code) is shown as "Open Claude Code" with the id
  // surfaced separately, not as a deep link to that id. See {@link describeSessionLink}.
  const sessionLink = describeSessionLink(session)

  if (!sessionLink && !status) return null

  return (
    <div className="grid gap-3 border-b border-border p-4 md:grid-cols-2">
      {status && (
        <div className="flex items-center gap-2 text-sm md:col-span-2">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', status.dot)} aria-hidden />
          {progress.sessionName && <span className="font-medium">{progress.sessionName}</span>}
          <span className={cn('text-xs', status.tone)}>{status.label}</span>
        </div>
      )}
      {sessionLink && (
        <a
          href={sessionLink.href}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline underline-offset-2 md:col-span-2"
        >
          {sessionLink.label}
        </a>
      )}
    </div>
  )
}
