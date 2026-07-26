import { useState } from 'react'
import type { WorkspaceTicketDetail } from '@gemstack/the-framework'
import { ArrowLeft, Check, ListPlus } from 'lucide-react'
import { onTicket } from '../server/reads.telefunc.js'
import { sendQueueTicket } from '../server/control.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { useAction } from '../lib/use-action.js'
import { Button } from './ui/button.js'
import { Badge } from './ui/badge.js'
import { Markdown } from './Markdown.js'
import { ScrollArea } from './ui/scroll-area.js'
import { cn } from '../lib/utils.js'
import { formatAge, formatDateTime } from '../lib/format-date.js'

/** How a priority reads, same tones as the list's dot (#1144) but spelled out here. */
const PRIORITY_TONE: Record<string, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
  medium: 'text-muted-foreground',
  low: 'text-muted-foreground',
}

/** How a status reads (#1144/#1230): open is the active, expected state; closed fades back. */
const STATUS_TONE: Record<'open' | 'closed', string> = {
  open: 'text-success',
  closed: 'text-muted-foreground',
}

// One ticket's own page (#1144): its entire markdown, not just the head the list row reads —
// and where Queue lives now that the list is one-liners. `slug` is the same filename the list
// row and the route carry, so this is a direct read by identity rather than a search through
// the list the caller may not even have.
export function TicketDetailPage({
  projectId,
  slug,
  onBack,
}: {
  projectId: string
  /** The ticket's filename inside `tickets/`, same as `WorkspaceTicket.file`. */
  slug: string
  /** Back to the tickets list. */
  onBack: () => void
}) {
  const { value: ticket, loaded } = usePolled<WorkspaceTicketDetail | null>(() => onTicket(projectId, slug), null, 10_000, [projectId, slug])
  const [queued, setQueued] = useState(false)
  const { busy, error, run } = useAction()

  const queue = async () => {
    if (!ticket) return
    const result = await run(
      () => sendQueueTicket(projectId, ticket.title, { file: ticket.file, ...(ticket.priority ? { priority: ticket.priority } : {}) }),
      'The ticket could not be queued.',
    )
    if (result?.ok) setQueued(true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Tickets
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl p-6">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !ticket ? (
            // Deleted between the list read and this one, or a stale/hand-typed link.
            <p className="text-sm text-muted-foreground">This ticket does not exist.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-lg font-semibold">{ticket.title}</h1>
                <Button size="sm" variant="outline" disabled={busy || queued} onClick={() => void queue()} className="shrink-0 gap-1.5">
                  {queued ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Queued
                    </>
                  ) : (
                    <>
                      <ListPlus className="h-3.5 w-3.5" /> Queue
                    </>
                  )}
                </Button>
              </div>
              {/* The date leads, on the left of the description (#1144): it is what tells two
                  similar-sounding tickets apart at a glance, before the meta below is read. */}
              <div className="mt-2 flex items-start gap-3">
                <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(ticket.date)}>
                  {formatAge(ticket.date)}
                </span>
                {ticket.summary && <p className="min-w-0 flex-1 text-sm text-muted-foreground">{ticket.summary}</p>}
              </div>
              {/* Meta below the description (#1144): status leads it, since open/closed is the
                  first thing worth knowing about a ticket. */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge className={cn('border-transparent px-0 text-[10px] uppercase', STATUS_TONE[ticket.status])}>{ticket.status}</Badge>
                {ticket.priority && (
                  <Badge className={cn('border-transparent px-0 text-[10px] uppercase', PRIORITY_TONE[ticket.priority])}>
                    {ticket.priority}
                  </Badge>
                )}
                {ticket.topics?.map(topic => (
                  <Badge key={topic} className="border-border px-1.5 text-[10px] text-muted-foreground">
                    {topic}
                  </Badge>
                ))}
                {ticket.spiked && <Badge className="border-transparent px-0 text-[10px] uppercase">spiked</Badge>}
                {ticket.planned && <Badge className="border-transparent px-0 text-[10px] uppercase">planned</Badge>}
                <span className="text-[10px] text-muted-foreground/70">{ticket.file}</span>
              </div>
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}
              <div className="mt-4">
                <Markdown text={ticket.content} />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
