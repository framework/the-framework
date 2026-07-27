import type { TicketsMeta, WorkspaceTicket } from '@gemstack/the-framework'
import { presets } from '@gemstack/the-framework/client'
import { RefreshCw, Github } from 'lucide-react'
import { sendStart } from '../server/control.telefunc.js'
import { onTicketsMeta } from '../server/reads.telefunc.js'
import { Button } from './ui/button.js'
import { Badge } from './ui/badge.js'
import { useAction } from '../lib/use-action.js'
import { useLoaded } from '../lib/use-async.js'
import { formatRelative, formatAge, formatDateTime } from '../lib/format-date.js'
import { priorityTone } from '../lib/ticket-priority.js'
import { cn } from '../lib/utils.js'
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

// The tickets list (#697/#1144): the project's `tickets/*.md` as one-liners — priority, topics,
// what the agent already did to it, and how recently, all on the row — so the backlog is scannable
// without opening one. A row's only action is opening its detail page (#1144), which is where
// Queue and the summary live. An empty `tickets/` offers to import the repo's GitHub issues instead
// of just saying "nothing here"; a filled one offers to update it (#1208) instead of a re-import
// re-walking the whole backlog.
export function TicketsPanel({
  projectId,
  tickets,
  loaded,
  hiddenByFilter = 0,
  onOpen,
  onRunStarted,
}: {
  projectId: string | null
  tickets: WorkspaceTicket[]
  loaded: boolean
  /** How many of this project's tickets the caller's status filter hid (#1144/#1230). An empty
   *  `tickets` with some hidden reads as "filtered", not as "nothing here" — the import prompt
   *  offers work that has already been done. */
  hiddenByFilter?: number
  /** Open one ticket's detail page (#1144), by its file — the same slug the route uses. */
  onOpen: (file: string) => void
  /** Told when the import session starts, so the shell can show it (#948) — the button used
   *  to flip "Starting…" and leave you staring at the still-empty panel. */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  const { busy, error, run } = useAction()
  // When `tickets/` last caught up with GitHub. Read here rather than passed down: the cross-
  // project page reads one ticket list per project, and this is the one extra read a section adds.
  const meta = useLoaded<TicketsMeta>(projectId ? () => onTicketsMeta(projectId) : null, NO_META, [projectId])

  if (!projectId) return null
  if (!loaded) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const startImport = async (prompt: string, failure: string) => {
    // Unattended (#1279): an import fired by a button is routine work, not a conversation — it
    // ends at settle and its armed handoff fires, as when the sweep starts the same routine.
    const result = await run(() => sendStart(projectId, prompt, 'prompt', { unattended: true }), failure)
    // Jump to the session doing the work, so its progress is watchable instead of the panel
    // sitting on stale rows until files land.
    if (result?.ok) onRunStarted?.(prompt, result.runId)
  }

  const importFromGithub = () => startImport(IMPORT_PROMPT, 'The import could not be started.')
  const updateFromGithub = () => startImport(UPDATE_PROMPT, 'The update could not be started.')

  if (tickets.length === 0 && hiddenByFilter > 0) {
    // Filtered to nothing, not genuinely empty (#1144/#1230): offering an import here would ask
    // for work already done.
    return (
      <div className="rounded-lg border border-border p-4 text-sm">
        <p className="text-muted-foreground">
          {hiddenByFilter} ticket{hiddenByFilter === 1 ? '' : 's'} hidden by the current filter.
        </p>
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
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
    <div className="overflow-hidden rounded-lg border border-border">
      {error && <p className="border-b border-border p-2 text-xs text-danger">{error}</p>}
      {/* Offered once there is something to update (#1208). On an empty `tickets/` the button
          above says "Import" instead: same work, but "update" would be a strange word for
          filling a directory that has never been filled. */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
        {/* The stamp and its action side by side (#1265) — the button used to sit flush right,
            a whole panel-width away from the line it acts on. */}
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {meta.lastImportedAt
            ? `Updated from GitHub ${formatRelative(meta.lastImportedAt)}`
            : 'No record of an import yet'}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-6 shrink-0 gap-1 px-2 text-xs"
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
      <ul className="divide-y divide-border">
        {tickets.map(ticket => (
          // The GitHub link sits beside the button rather than inside it: a link inside a button
          // is invalid HTML, and the two go different places — the row to the detail page, the
          // link out to the issue.
          <li key={ticket.file} className="flex items-stretch transition-colors hover:bg-accent/60">
            <button
              type="button"
              onClick={() => onOpen(ticket.file)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
            >
              {/* Only closed is called out (#1144/#1230): open is the row's default assumption,
                  same as spiked/planned only showing when true. */}
              {ticket.status === 'closed' && (
                <Badge className="shrink-0 border-transparent px-1.5 text-[10px] uppercase text-muted-foreground">closed</Badge>
              )}
              {/* The title is the row's one flexible column: it truncates when long and stretches
                  when short, so the whole of a row's slack lands here — the way a table's wide
                  first column carries the blank — instead of pooling mid-row between columns. */}
              <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
              {/* The tags, content-sized and packed against the priority column (#1265): their
                  right edge is the aligned one, so rows with one tag and rows with four read as
                  the same right-aligned column. */}
              <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                {ticket.topics?.map(topic => (
                  <Badge key={topic} className="shrink-0 border-border px-1.5 text-[10px] text-muted-foreground">
                    {topic}
                  </Badge>
                ))}
                {/* What the agent has already done to this ticket, so it is clear what is left. */}
                {ticket.spiked && <Badge className="shrink-0 border-transparent px-1 text-[10px] uppercase">spiked</Badge>}
                {ticket.planned && <Badge className="shrink-0 border-transparent px-1 text-[10px] uppercase">planned</Badge>}
                {ticket.effort && (
                  <Badge className="shrink-0 border-transparent px-1 text-[10px] text-muted-foreground">Effort: {ticket.effort}</Badge>
                )}
              </span>
              {/* Priority and date: snug fixed widths — barely wider than their content, kept
                  fixed (and rendered even when empty) so the columns still line up down the
                  table row to row. */}
              <span className={cn('w-16 shrink-0 text-right text-[10px]', priorityTone(ticket.priority))}>
                {ticket.priority ? `Priority: ${ticket.priority}` : ''}
              </span>
              <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground/70" title={formatDateTime(ticket.date)}>
                {formatAge(ticket.date)}
              </span>
            </button>
            {ticket.github ? (
              <a
                href={ticket.github.url}
                target="_blank"
                rel="noreferrer"
                className="flex w-20 shrink-0 items-center justify-end gap-1 px-3 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Github className="h-4 w-4" aria-hidden />
                {ticket.github.label}
              </a>
            ) : (
              // Same width as the link so the button's right edge — and with it the priority and
              // date columns inside — stays put on a row with no issue to link.
              <span className="w-20 shrink-0" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
