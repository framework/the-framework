import type { ReactNode } from 'react'
import type { FrameworkEvent } from '@gemstack/the-framework'
import { TriangleAlert } from 'lucide-react'
import { EventList } from './EventList.js'
import { RunOverview } from './RunOverview.js'

// One run's feed: the run overview plus the live/replayed event log, or a waiting placeholder
// before anything has streamed. Shared by the run's own view (RunView, which shows the session
// link in its action bar instead — `showSessionLink={false}`) and the read-only relay watch view
// (RelayView, which keeps it since it has no action bar). `lost` is the live channel's health
// (#948): while the stream is down the feed is behind reality, and saying so beats letting
// "the agent went quiet" and "the connection died" look identical.
export function RunFeed({
  events,
  showSessionLink = true,
  showName = true,
  showStatus = true,
  lost = false,
  stick = true,
  openAt,
  emptyLabel = 'Waiting for the session to start…',
  tail,
  projectId,
  runId,
}: {
  events: FrameworkEvent[]
  /** The feed's own project/run (#1455 item 6): with a projectId the log's `choice` rows become
   *  the interaction (inline panels/answered cards). The relay watch passes nothing — read-only. */
  projectId?: string | undefined
  runId?: string | null | undefined
  showSessionLink?: boolean
  /** The run's own view sets this false: its action bar's breadcrumb already names the session. */
  showName?: boolean
  /** The run's own view sets this false: its action bar carries the status beside the ⋮ menu. */
  showStatus?: boolean
  /** The run's own view sets this false: its right rail pins the loop's verdict under the tabs. */
  lost?: boolean
  /** A finished log is static (#1026): it does not follow new output, and opens at its end. */
  stick?: boolean
  openAt?: 'start' | 'end'
  /** What an empty feed says: a live run is waiting, a finished one has nothing to replay. */
  emptyLabel?: string
  /** Rendered after the last log row, inside the scroller (#1265): a web run's live mirror box. */
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
      <RunOverview events={events} showSessionLink={showSessionLink} showName={showName} showStatus={showStatus} />
      <EventList
        events={events}
        stick={stick}
        {...(openAt ? { openAt } : {})}
        {...(tail ? { tail } : {})}
        {...(projectId ? { projectId, runId } : {})}
      />
    </>
  )
}
