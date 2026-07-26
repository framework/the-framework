import type { TicketsMeta, WorkspaceTicket } from '@gemstack/the-framework'
import { presets } from '@gemstack/the-framework/client'
import { RefreshCw } from 'lucide-react'
import { sendStart } from '../server/control.telefunc.js'
import { onTicketsMeta } from '../server/reads.telefunc.js'
import { Button } from './ui/button.js'
import { Badge } from './ui/badge.js'
import { useAction } from '../lib/use-action.js'
import { useLoaded } from '../lib/use-async.js'
import { formatRelative } from '../lib/format-date.js'
import { cn } from '../lib/utils.js'
import { ScrollArea } from './ui/scroll-area.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

/**
 * The prompt behind "Import tickets from GitHub" (#697), read from the preset rather than written
 * here. This panel and the onboarding checklist offer the same button under the same label, and
 * they were sending different instructions: this text, against the preset's four bare words. Two
 * prompts behind one label is a button whose behaviour depends on where it was pressed.
 *
 * Deliberately short even so: the agent has `gh` and the ticket format already, and #674 settled
 * that over-specifying a preset earns nothing the context fragment does not already carry.
 */
const IMPORT_PROMPT = presets.importTickets.render()

/**
 * The prompt behind "Update from GitHub" (#1208), the second and every later import. Read from its
 * own preset for the same reason: one label, one instruction, wherever it is offered from.
 *
 * A separate preset rather than a flag on the import, because the two ask for different work. The
 * import fills an empty directory; this one reconciles a full one against what changed, and has to
 * be told to leave the spikes and plans already written against a ticket alone.
 */
const UPDATE_PROMPT = presets.updateTickets.render()

/** Captured once: `useLoaded` treats a fresh `{}` literal as a new value on every render. */
const NO_META: TicketsMeta = {}

/** How a priority reads, as the one-liner's dot (#1144) — a full badge has no room on a single line. */
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-danger',
  high: 'bg-warning',
  medium: 'bg-muted-foreground',
  low: 'bg-muted-foreground',
}

// The tickets list (#697/#1144): the project's `tickets/*.md` as one-liners, so the whole backlog
// is scannable at a glance; a row's only action is opening its detail page (#1144), which is where
// Queue, the summary, and the rest of the metadata live now. An empty `tickets/` offers to import
// the repo's GitHub issues instead of just saying "nothing here"; a filled one offers to update it
// (#1208) instead of a re-import re-walking the whole backlog.
export function TicketsPanel({
  projectId,
  tickets,
  loaded,
  onOpen,
  onRunStarted,
}: {
  projectId: string | null
  tickets: WorkspaceTicket[]
  loaded: boolean
  /** Open one ticket's detail page (#1144), by its file — the same slug the route uses. */
  onOpen: (file: string) => void
  /** Told when the import session starts, so the shell can show it (#948) — the button used
   *  to flip "Starting…" and leave you staring at the still-empty panel. */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  const { busy, error, run } = useAction()
  // When `tickets/` last caught up with GitHub. Read here rather than passed down: the rail polls
  // the tickets themselves for the tab's row count, and it has no use for the stamp.
  const meta = useLoaded<TicketsMeta>(projectId ? () => onTicketsMeta(projectId) : null, NO_META, [projectId])

  if (!projectId) return null
  if (!loaded) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const startImport = async (prompt: string, failure: string) => {
    const result = await run(() => sendStart(projectId, prompt, 'prompt'), failure)
    // Jump to the session doing the work, so its progress is watchable instead of the panel
    // sitting on stale rows until files land.
    if (result?.ok) onRunStarted?.(prompt, result.runId)
  }

  const importFromGithub = () => startImport(IMPORT_PROMPT, 'The import could not be started.')
  const updateFromGithub = () => startImport(UPDATE_PROMPT, 'The update could not be started.')

  if (tickets.length === 0) {
    return (
      <div className="space-y-3 p-4 text-sm">
        <p className="text-muted-foreground">
          No tickets yet. Tickets live in <code className="rounded bg-muted px-1">tickets/</code> and are what the agent
          plans from.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void importFromGithub()}>
          {busy ? 'Starting…' : 'Import tickets from GitHub'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-auto flex-col">
      {error && <p className="border-b border-border p-2 text-xs text-danger">{error}</p>}
      {/* Offered once there is something to update (#1208). On an empty `tickets/` the button
          above says "Import" instead: same work, but "update" would be a strange word for
          filling a directory that has never been filled. */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {meta.lastImportedAt
            ? `Updated from GitHub ${formatRelative(meta.lastImportedAt)}`
            : 'No record of an import yet'}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 gap-1 px-1.5 text-xs"
                disabled={busy}
                onClick={() => void updateFromGithub()}
              />
            }
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {busy ? 'Starting…' : 'Update from GitHub'}
          </TooltipTrigger>
          <TooltipContent>
            {meta.lastImportedAt
              ? 'Bring tickets/ up to date with the issues and comments changed since the last import.'
              : 'Bring tickets/ up to date with GitHub. With no import on record, everything open comes across.'}
          </TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="min-h-0 flex-auto">
        <ul className="divide-y divide-border">
          {tickets.map(ticket => (
            <li key={ticket.file}>
              <button
                type="button"
                onClick={() => onOpen(ticket.file)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60"
              >
                {ticket.priority && (
                  <span
                    aria-hidden
                    title={ticket.priority}
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_TONE[ticket.priority])}
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
                {/* What the agent has already done to this ticket, so it is clear what is left. */}
                {ticket.spiked && <Badge className="shrink-0 border-transparent px-1 text-[10px] uppercase">spiked</Badge>}
                {ticket.planned && <Badge className="shrink-0 border-transparent px-1 text-[10px] uppercase">planned</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  )
}
