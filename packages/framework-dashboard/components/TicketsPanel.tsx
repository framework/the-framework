import { useState } from 'react'
import type { TicketsMeta, WorkspaceTicket } from '@gemstack/the-framework'
import { presets } from '@gemstack/the-framework/client'
import { ListPlus, Check, RefreshCw } from 'lucide-react'
import { sendQueueTicket, sendStart } from '../server/control.telefunc.js'
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

/** How a priority reads, for the ones the format names. */
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
  medium: 'text-muted-foreground',
  low: 'text-muted-foreground',
}

// The tickets view (#697): the project's `tickets/*.md`, so the backlog the agent plans from
// is readable without opening the repo. Each row can be put on the agent queue, and an empty
// `tickets/` offers to import the repo's GitHub issues instead of just saying "nothing here".
export function TicketsPanel({
  projectId,
  tickets,
  loaded,
  onRunStarted,
}: {
  projectId: string | null
  /** Read in the rail (#1146), which needs the count to decide whether to offer the tab. */
  tickets: WorkspaceTicket[]
  loaded: boolean
  /** Told when the import session starts, so the shell can show it (#948) — the button used
   *  to flip "Starting…" and leave you staring at the still-empty panel. */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
}) {
  // Which tickets this session has queued. The queue is a file, not a field on the ticket, so
  // there is nothing on the ticket to re-read; remembering the click is what stops a row
  // reading as un-queued the moment the poll returns.
  const [queued, setQueued] = useState<Set<string>>(new Set())
  const { busy, error, run } = useAction()
  // When `tickets/` last caught up with GitHub. Read here rather than passed down: the rail polls
  // the tickets themselves for the tab's row count, and it has no use for the stamp.
  const meta = useLoaded<TicketsMeta>(projectId ? () => onTicketsMeta(projectId) : null, NO_META, [projectId])

  if (!projectId) return null
  if (!loaded) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const queue = async (ticket: WorkspaceTicket) => {
    // The ticket travels with the entry (#1164): it decides which priority section the entry
    // lands in, and it is what the queued line links back to.
    const result = await run(
      () =>
        sendQueueTicket(projectId, ticket.title, {
          file: ticket.file,
          ...(ticket.priority ? { priority: ticket.priority } : {}),
        }),
      'The ticket could not be queued.',
    )
    if (result?.ok) setQueued(prev => new Set(prev).add(ticket.file))
  }

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
        <div className="p-2">
        {tickets.map(ticket => (
          <div key={ticket.file} className="mb-1 rounded border border-border p-2">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium">{ticket.title}</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 gap-1 px-1.5 text-xs"
                      disabled={busy || queued.has(ticket.file)}
                      onClick={() => void queue(ticket)}
                    />
                  }
                >
                  {queued.has(ticket.file) ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Queued
                    </>
                  ) : (
                    <>
                      <ListPlus className="h-3.5 w-3.5" /> Queue
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {queued.has(ticket.file)
                    ? 'Already added to the queue'
                    : 'Add to Queue (TODO_AGENTS.md), for the next session to work on'}
                </TooltipContent>
              </Tooltip>
            </div>
            {ticket.summary && <p className="mt-0.5 text-xs text-muted-foreground">{ticket.summary}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {ticket.priority && (
                <Badge className={cn('border-transparent px-0 text-[10px] uppercase', PRIORITY_TONE[ticket.priority])}>
                  {ticket.priority}
                </Badge>
              )}
              {/* What the agent has already done to this ticket, so it is clear what is left. */}
              {ticket.spiked && <Badge className="border-transparent px-0 text-[10px] uppercase">spiked</Badge>}
              {ticket.planned && <Badge className="border-transparent px-0 text-[10px] uppercase">planned</Badge>}
              <span className="truncate text-[10px] text-muted-foreground/70">{ticket.file}</span>
            </div>
          </div>
        ))}
        </div>
      </ScrollArea>
    </div>
  )
}
