import type { WorkspaceTicket } from '@gemstack/the-framework'
import { onTickets } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { TicketsPanel } from './TicketsPanel.js'

/** Stable initial for the poll, so it does not churn on every render. */
const EMPTY_TICKETS: WorkspaceTicket[] = []

/**
 * The active project's tickets on the launcher (#1455 item 5): the same presentation as the
 * /tickets page — TicketsPanel is that page's per-project list, freshness bar and GitHub
 * import/update buttons included — scoped to the current project instead of every registered one.
 *
 * Open tickets only, in the /tickets page's default order (newest first, as `readTickets` hands
 * them back); the closed remainder rides `hiddenByFilter` so the panel can say what the scoping
 * hides, and the header links to the full cross-project page for everything else.
 */
export function ProjectTickets({
  projectId,
  onOpenTicket,
  onShowAllTickets,
  onRunStarted,
}: {
  projectId: string
  /** Open one ticket's detail page, by file. */
  onOpenTicket: (file: string) => void
  /** Jump to the full cross-project /tickets page. */
  onShowAllTickets: () => void
  /** Told when the panel's import/update session starts, so the shell can show it (#948). */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  const { value: tickets, loaded } = usePolled<WorkspaceTicket[]>(() => onTickets(projectId), EMPTY_TICKETS, 10_000, [projectId])
  const open = tickets.filter(t => t.status === 'open')
  // A project with no tickets/ directory gets no section: the /tickets page is where a backlog
  // is started, and an empty panel with import buttons on every launch is what HotTickets is not.
  if (!loaded || tickets.length === 0) return null
  return (
    <section aria-label="Tickets" className="border-t border-border p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tickets · {open.length} open
        </h2>
        <button type="button" onClick={onShowAllTickets} className="text-xs text-muted-foreground hover:text-foreground">
          All projects →
        </button>
      </div>
      <TicketsPanel
        projectId={projectId}
        tickets={open}
        loaded
        hiddenByFilter={tickets.length - open.length}
        onOpen={onOpenTicket}
        onRunStarted={onRunStarted}
      />
    </section>
  )
}
