import { useState } from 'react'
import type { ProjectTickets, WorkspaceTicket } from '@gemstack/the-framework'
import { onAllTickets } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { parsePriority } from '../lib/ticket-priority.js'
import { ScrollArea } from './ui/scroll-area.js'
import { TicketsPanel } from './TicketsPanel.js'

/** Stable initial for the cross-project tickets poll, so it does not churn on every render. */
const EMPTY_GROUPS: ProjectTickets[] = []

type SortBy = 'date' | 'priority'

/**
 * Orders a project's (already filtered) tickets for display (#1144/#1265). `readTickets` hands
 * back newest-first, which is exactly what "Date" means here, so that option is a no-op; "Priority"
 * re-sorts highest-first, and a tie — including two tickets that name none — falls back to that
 * same newest-first order rather than an arbitrary one.
 */
function sortTickets(tickets: WorkspaceTicket[], sortBy: SortBy): WorkspaceTicket[] {
  if (sortBy === 'date') return tickets
  return [...tickets].sort((a, b) => {
    const diff = (parsePriority(b.priority) ?? -1) - (parsePriority(a.priority) ?? -1)
    return diff !== 0 ? diff : b.date.localeCompare(a.date)
  })
}

// The Tickets view (#1144): every registered project's `tickets/*.md`, one section per project —
// its own full page rather than a tab squeezed into the 22rem right rail, and cross-project rather
// than scoped to whichever project happened to be selected, since the backlog is worth seeing
// whole. Each section is its own poll-independent TicketsPanel (list, priority/topics/date, its own
// Update-from-GitHub bar), so one project's slow read never blanks another's.
export function TicketsPage({
  onOpenTicket,
  onOpenTicketPlan,
  onRunStarted,
}: {
  /** Open one ticket's detail page (#1144), by its project and file. */
  onOpenTicket: (projectId: string, file: string) => void
  /** Open one ticket's plan view (#685), by its project and file — the plan column's link. */
  onOpenTicketPlan?: ((projectId: string, file: string) => void) | undefined
  /** Told when an import/update session starts, so the shell can show it (#948) — which project
   *  started it is not implied the way it is for a single-project page, so each section binds
   *  its own id below rather than this prop guessing. */
  onRunStarted?: ((projectId: string, intent: string, runId?: string) => void) | undefined
}) {
  const { value: groups, loaded } = usePolled<ProjectTickets[]>(onAllTickets, EMPTY_GROUPS, 10_000, [])
  const [sortBy, setSortBy] = useState<SortBy>('date')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Tickets</h1>
          <p className="text-xs text-muted-foreground">
            Every project&apos;s <code className="rounded bg-muted px-1">tickets/</code> backlog — what the agent plans from.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <label htmlFor="tickets-sort-by">Sort by:</label>
          <select
            id="tickets-sort-by"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          >
            <option value="date">Date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {/* The full page width, no columns and no max-width (#1144/#1265): each project's table
            spans the whole pane, so a row has room for its title and every piece of meta at once.
            Columns looked tidy but split the one dimension the rows actually need. */}
        <div className="w-full p-6">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects registered yet.</p>
          ) : (
            <div className="space-y-8">
              {groups.map(g => (
                <section key={g.projectId} className="min-w-0 space-y-2">
                  <h2 className="truncate text-sm font-semibold">{g.projectName}</h2>
                  <TicketsPanel
                    projectId={g.projectId}
                    tickets={sortTickets(g.tickets, sortBy)}
                    loaded
                    onOpen={file => onOpenTicket(g.projectId, file)}
                    onOpenPlan={onOpenTicketPlan ? file => onOpenTicketPlan(g.projectId, file) : undefined}
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
