import type { ProjectTickets } from '@gemstack/the-framework'
import { onAllTickets } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { ScrollArea } from './ui/scroll-area.js'
import { TicketsPanel } from './TicketsPanel.js'

/** Stable initial for the cross-project tickets poll, so it does not churn on every render. */
const EMPTY_GROUPS: ProjectTickets[] = []

// The Tickets view (#1144): every registered project's `tickets/*.md`, one section per project —
// its own full page rather than a tab squeezed into the 27rem right rail, and cross-project rather
// than scoped to whichever project happened to be selected, since the backlog is worth seeing
// whole. Each section is its own poll-independent TicketsPanel (list, priority/topics/date, its own
// Update-from-GitHub bar), so one project's slow read never blanks another's.
export function TicketsPage({
  onOpenTicket,
  onRunStarted,
}: {
  /** Open one ticket's detail page (#1144), by its project and file. */
  onOpenTicket: (projectId: string, file: string) => void
  /** Told when an import/update session starts, so the shell can show it (#948) — which project
   *  started it is not implied the way it is for a single-project page, so each section binds
   *  its own id below rather than this prop guessing. */
  onRunStarted?: ((projectId: string, intent: string, runId?: string) => void) | undefined
}) {
  const { value: groups, loaded } = usePolled<ProjectTickets[]>(onAllTickets, EMPTY_GROUPS, 10_000, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-base font-semibold">Tickets</h1>
        <p className="text-xs text-muted-foreground">
          Every project&apos;s <code className="rounded bg-muted px-1">tickets/</code> backlog — what the agent plans from.
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="w-full p-6">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects registered yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {groups.map(g => (
                <section key={g.projectId} className="min-w-0 space-y-2">
                  <h2 className="truncate text-sm font-semibold">{g.projectName}</h2>
                  <TicketsPanel
                    projectId={g.projectId}
                    tickets={g.tickets}
                    loaded
                    onOpen={file => onOpenTicket(g.projectId, file)}
                    onRunStarted={(intent, runId) => onRunStarted?.(g.projectId, intent, runId)}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
