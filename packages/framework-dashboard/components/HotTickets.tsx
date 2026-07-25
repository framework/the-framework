import type { HotTicket, HotBucket } from '@gemstack/the-framework'
import { Flame } from 'lucide-react'
import { onHotTickets } from '../server/reads.telefunc.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { usePolled } from '../lib/use-async.js'
import { cn } from '../lib/utils.js'

// The Overview's "hot tickets" card (#1139): a cross-project glance at what the agent is working on
// (in progress), what sits in the AI Queue, and what is flagged high priority — nothing else. A
// projection of every project's `tickets/` + `TODO_AGENTS.md` over the `onHotTickets` read, polled
// so it stays live. Selecting a ticket jumps into its project.

const EMPTY: HotTicket[] = []

// The three lanes the card shows (#1139), each carrying the dot colour that matches the rest of the
// status vocabulary (primary = active, warning = queued, info = flagged). Two columns (#1139): the
// two lanes you act on off the queue — what is being worked, and what is queued next — stacked on
// the left, with the priority shortlist alone on the right.
interface LaneDef {
  key: HotBucket
  label: string
  dot: string
}
const LEFT_LANES: LaneDef[] = [
  { key: 'in-progress', label: 'In progress', dot: 'bg-primary' },
  { key: 'ai-queue', label: 'AI Queue', dot: 'bg-warning' },
]
const RIGHT_LANES: LaneDef[] = [{ key: 'high-priority', label: 'High priority', dot: 'bg-info' }]

export function HotTickets({
  onSelectProject,
  onSelectRun,
}: {
  onSelectProject: (id: string) => void
  /** A ticket a run is implementing knows which run (#1117), so its row opens that session. */
  onSelectRun: (id: string, runId: string) => void
}) {
  const { value: tickets } = usePolled<HotTicket[]>(onHotTickets, EMPTY, 10_000, [])

  const renderLane = (lane: LaneDef) => (
    <Lane
      key={lane.key}
      lane={lane}
      tickets={tickets.filter(t => t.bucket === lane.key)}
      onSelectProject={onSelectProject}
      onSelectRun={onSelectRun}
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-muted-foreground" />
          Hot tickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          <div className="grid items-start gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="flex flex-col gap-5">{LEFT_LANES.map(renderLane)}</div>
            <div className="flex flex-col gap-5">{RIGHT_LANES.map(renderLane)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Lane({
  lane,
  tickets,
  onSelectProject,
  onSelectRun,
}: {
  lane: LaneDef
  tickets: HotTicket[]
  onSelectProject: (id: string) => void
  onSelectRun: (id: string, runId: string) => void
}) {
  const empty = tickets.length === 0
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        {/* An empty lane dims to a single header line rather than a paragraph, so the populated
            lane carries the card and the zeros still say "nothing here" at a glance. */}
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', lane.dot, empty && 'opacity-40')} />
        <span className={empty ? 'text-muted-foreground' : 'text-foreground/80'}>{lane.label}</span>
        <span className="tabular-nums text-muted-foreground/70">{tickets.length}</span>
      </div>
      {!empty && (
        // Every ticket in the lane, never a "+N more" — the card is the shortlist, and a lane you
        // cannot read past is one you have to leave the page to act on.
        <ul className="mt-1.5">
          {tickets.map(t => (
            <li key={`${t.projectId}:${t.ticket.file}`}>
              <button
                type="button"
                // A ticket being implemented names its run, and that session is what the row is
                // reporting; one with no run yet has only its project to offer.
                onClick={() => (t.runId ? onSelectRun(t.projectId, t.runId) : onSelectProject(t.projectId))}
                title={t.ticket.summary || t.ticket.title}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.ticket.title}</span>
                <TicketTag ticket={t} />
                <span className="shrink-0 text-xs text-muted-foreground">{t.projectName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// The one fact that earns the lane: a run implementing it right now, else the plan/spike that made
// it in-progress, else the priority that put it in the high-priority lane. AI-Queue rows carry
// nothing extra — the lane already says it.
//
// `implementing` is coloured rather than muted like the others (#1117), because it is the only tag
// that describes something happening as you read it: `planned` and `spiked` are marks work left
// behind, and a lane holding both should not read as though they were the same claim.
function TicketTag({ ticket: t }: { ticket: HotTicket }) {
  if (t.runId) {
    return (
      <span className="shrink-0 rounded border border-primary/40 px-1 text-[10px] uppercase tracking-wide text-primary">
        implementing
      </span>
    )
  }
  const tag =
    t.bucket === 'in-progress'
      ? t.ticket.planned
        ? 'planned'
        : t.ticket.spiked
          ? 'spiked'
          : null
      : t.bucket === 'high-priority'
        ? t.ticket.priority ?? null
        : null
  if (!tag) return null
  return (
    <span className="shrink-0 rounded border border-border px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {tag}
    </span>
  )
}
