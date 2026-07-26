import type { WorkspaceTicket } from '@gemstack/the-framework'
import { onTickets } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { TicketsPanel } from './TicketsPanel.js'

/** Stable initial for the tickets poll, so it does not churn on every render. */
const EMPTY_TICKETS: WorkspaceTicket[] = []

// The tickets page (#1144): the project's `tickets/*.md` as its own full page rather than a tab
// squeezed into the 27rem right rail — the backlog is what a demo wants read at full width, not
// through a narrow window. Owns its own poll, the way the rail used to, since nothing else on this
// page needs the read; the row rendering itself stays in TicketsPanel so the two surfaces agree on
// what a ticket looks like.
export function TicketsPage({
  projectId,
  onRunStarted,
}: {
  projectId: string
  /** Told when the import session starts, so the shell can show it (#948). */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  const { value: tickets, loaded } = usePolled<WorkspaceTicket[]>(() => onTickets(projectId), EMPTY_TICKETS, 10_000, [projectId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-base font-semibold">Tickets</h1>
        <p className="text-xs text-muted-foreground">
          The project&apos;s <code className="rounded bg-muted px-1">tickets/</code> backlog — what the agent plans from.
        </p>
      </div>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <TicketsPanel projectId={projectId} tickets={tickets} loaded={loaded} onRunStarted={onRunStarted} />
      </div>
    </div>
  )
}
