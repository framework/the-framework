import type { ReactNode } from 'react'
import type { FrameworkEvent } from '../../src/index.js'
import { TriangleAlert } from 'lucide-react'
import { EventList } from './EventList.js'

// One agent's feed: the live/replayed event log, or a waiting placeholder before anything has
// streamed. Rendered by the agent's own view (AgentView), whose action bar already carries the
// session link, the session name and the status. `lost` is the live channel's health (#948):
// while the stream is down the feed is behind reality, and saying so beats letting "the agent
// went quiet" and "the connection died" look identical.
export function AgentFeed({
  events,
  lost = false,
  stick = true,
  openAt,
  emptyLabel = 'Waiting for the session to start…',
  tail,
  projectId,
  agentId: agentId,
}: {
  events: FrameworkEvent[]
  /** The feed's own project/run (#1455 item 6): the log's `choice` rows are the interaction
   *  (inline panels/answered cards). Required, so no caller can silently downgrade an open gate
   *  to log text — a gate rendered as text is a run parked with nothing to answer it (#846). */
  projectId: string
  agentId?: string | null | undefined
  lost?: boolean
  /** A finished log is static (#1026): it does not follow new output, and opens at its end. */
  stick?: boolean
  openAt?: 'start' | 'end'
  /** What an empty feed says: a live agent is waiting, a finished one has nothing to replay. */
  emptyLabel?: string
  /** Rendered after the last log row, inside the scroller (#1265): a web agent's live mirror box. */
  tail?: ReactNode
}) {
  const lostBanner = lost && (
    <div role="status" className="flex items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Live stream lost — reconnecting. The session keeps running; this view may be behind.
    </div>
  )
  if (events.length === 0) {
    return (
      <>
        {lostBanner}
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground">{emptyLabel}</div>
      </>
    )
  }
  return (
    <>
      {lostBanner}
      <EventList
        events={events}
        stick={stick}
        {...(openAt ? { openAt } : {})}
        {...(tail ? { tail } : {})}
        projectId={projectId}
        agentId={agentId}
      />
    </>
  )
}
