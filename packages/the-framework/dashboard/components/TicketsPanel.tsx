import type { TicketsMeta, WorkspaceTicket } from '../../dist/index.js'
import { presets } from '../../dist/client.js'
import { RefreshCw, Github, ClipboardPlus, ClipboardList, Hammer, Play } from 'lucide-react'
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
 * be told to leave the plans already written against a ticket alone.
 */
const UPDATE_PROMPT = presets.updateTickets.render()

/** Captured once: `useLoaded` treats a fresh `{}` literal as a new value on every render. */
const NO_META: TicketsMeta = {}

/**
 * The prompt the plan column's create button starts a session with (#685): write this ticket's plan.
 * The `<TICKET>` is the ticket's stem — its `.md` name without the extension — so
 * `2026-07-20_do-the-thing.md` asks for `tickets/2026-07-20_do-the-thing.plan.md`, the sibling the
 * plan link then reads. Plain text, not a preset, and exported so the test asserts the exact ask:
 * a hidden second copy of the prompt is what #1187 was about.
 */
export function planPrompt(file: string): string {
  return `Create tickets/${file.replace(/\.md$/, '')}.plan.md`
}

/**
 * The prompt the start column fires a session with: work on this one ticket, nothing else. The
 * same sentence `workOnTicketDraft` (HotTickets) drafts into the launcher — the drain preset's
 * vocabulary narrowed to the one ticket the row names — but sent directly: the button is a start,
 * not a draft. Exported so the test asserts the exact ask rather than a copy (#1187).
 */
export function workOnTicketPrompt(file: string): string {
  return `Work on tickets/${file}. Do not start any other ticket.`
}

/**
 * One ticket as a one-liner row (#697/#1144): the start column, title, project (flat mode only),
 * topics, claim, effort/uncertainty, priority, age, the plan column, and the GitHub link.
 * Extracted from the panel so the flat cross-project list (#1144's Group: none) renders the same
 * row with per-row project context.
 *
 * The metadata cluster is a *sibling* of the row's open button, not a child — same rule as the
 * plan cell and the GitHub link (an interactive control nested in a button is invalid HTML), and
 * since the topic badges and the claim marker filter on click (#1144), they are controls now.
 */
export function TicketRow({
  ticket,
  projectName,
  busy,
  onOpen,
  onStartWork,
  onOpenPlan,
  onStartPlan,
  onTopicClick,
  onClaimedClick,
}: {
  ticket: WorkspaceTicket
  /** Shown on the row in the flat cross-project list, where the section heading no longer says it. */
  projectName?: string | undefined
  /** Disables the session-starting buttons while a session start is in flight. */
  busy: boolean
  onOpen: () => void
  /** The start column: spin up an agent implementing this one ticket. */
  onStartWork: () => void
  onOpenPlan?: (() => void) | undefined
  onStartPlan: () => void
  /** Click-to-filter (#1144): a topic badge adds its topic to the page's filter. Without a
   *  handler the topics render as plain badges. */
  onTopicClick?: ((topic: string) => void) | undefined
  /** Click-to-filter for the claim marker: narrows the page to claimed tickets. */
  onClaimedClick?: (() => void) | undefined
}) {
  return (
    <li className="flex items-stretch transition-colors hover:bg-accent/60">
      {/* The start column, the row's left edge: one click spins up an agent implementing this
          ticket — the AI Queue card's play button (#855), offered where the backlog is read
          instead of only after queueing. A sibling of the open button like every control on the
          row (an interactive control nested in a button is invalid HTML): starting is not opening. */}
      <div className="flex w-10 shrink-0 items-center justify-center">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onStartWork}
                disabled={busy}
                aria-label={`Start work on ${ticket.title}`}
                // Quiet like the plan column's create button: an available action, not a state.
                className="text-muted-foreground/50 hover:text-foreground disabled:opacity-50"
              />
            }
          >
            <Play className="h-4 w-4" aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Spin up an agent working on this ticket</TooltipContent>
        </Tooltip>
      </div>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-0 pr-3 text-left text-sm">
        {/* The title is the row's one flexible column: it truncates when long and stretches
            when short, so the whole of a row's slack lands here — the way a table's wide
            first column carries the blank — instead of pooling mid-row between columns. */}
        <span className="min-w-0 flex-1 truncate font-medium">{ticket.title}</span>
      </button>
      {projectName && <span className="flex shrink-0 items-center pr-2 text-xs text-muted-foreground">{projectName}</span>}
      {/* The tags, content-sized and packed against the priority column (#1265): their right edge
          is the aligned one, so rows with one tag and rows with four read as the same
          right-aligned column. */}
      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {ticket.topics?.map(topic =>
          onTopicClick ? (
            <button
              key={topic}
              type="button"
              onClick={() => onTopicClick(topic)}
              title={`Filter by ${topic}`}
              className="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              {topic}
            </button>
          ) : (
            <Badge key={topic} className="shrink-0 border-border px-1.5 text-[10px] text-muted-foreground">
              {topic}
            </Badge>
          ),
        )}
        {/* An agent holds this ticket's `.lock.md` (#1420) — it is planning the ticket or
            implementing it directly; the hammer says "being worked" either way. The holder is
            named inline, not only in the tooltip — a still 1-2s hover is how nobody discovers
            anything. Truncated to keep the dense row aligned; the tooltip keeps the full id. */}
        {ticket.locked && (
          <Tooltip>
            <TooltipTrigger
              render={
                onClaimedClick ? (
                  <button
                    type="button"
                    onClick={onClaimedClick}
                    className="flex shrink-0 items-center gap-1 text-[10px] text-warning hover:opacity-80"
                  />
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-[10px] text-warning" />
                )
              }
            >
              <Hammer className="h-3.5 w-3.5" aria-hidden />
              {ticket.lockedBy && <span className="inline-block max-w-[8rem] truncate">{ticket.lockedBy}</span>}
            </TooltipTrigger>
            <TooltipContent>
              {`Claimed${ticket.lockedBy ? ` by ${ticket.lockedBy}` : ''} — an agent is working on this ticket (planning it or implementing it).`}
              {onClaimedClick ? ' Click to see all claimed tickets.' : ''}
            </TooltipContent>
          </Tooltip>
        )}
        {ticket.effort !== undefined && (
          <Badge className="shrink-0 border-transparent px-1 text-[10px] text-muted-foreground">Effort: {ticket.effort}</Badge>
        )}
        {ticket.uncertainty !== undefined && (
          <Badge className="shrink-0 border-transparent px-1 text-[10px] text-muted-foreground">Uncertainty: {ticket.uncertainty}</Badge>
        )}
      </span>
      {/* Priority and date: snug fixed widths — barely wider than their content, kept fixed (and
          rendered even when empty) so the columns still line up down the table row to row. */}
      <span className={cn('flex w-16 shrink-0 items-center justify-end text-[10px]', priorityTone(ticket.priority))}>
        {ticket.priority ? `Priority: ${ticket.priority}` : ''}
      </span>
      <span
        className="flex w-14 shrink-0 items-center justify-end text-[10px] text-muted-foreground/70"
        title={formatDateTime(ticket.date)}
      >
        {formatAge(ticket.date)}
      </span>
      {/* The plan column (#685): a `.plan.md` is either there to read or waiting to be written.
          Planned → a link to the rendered plan; not planned → a button that starts a session to
          write one. A sibling of the row's button, not a child, for the same reason the GitHub
          link is: an interactive control nested in a button is invalid HTML, and the two go
          different places. */}
      <div className="flex w-10 shrink-0 items-center justify-center">
        {ticket.planned ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onOpenPlan?.()}
                  disabled={!onOpenPlan}
                  aria-label={`View the plan for ${ticket.title}`}
                  // Strong blue for a plan that exists, thicker-stroked (2.5) so it reads
                  // bolder still against the light-grey create button below — colour and
                  // weight together tell the two near-identical clipboards apart and make the
                  // planned rows scannable. `info` is the theme's only blue (`primary` is
                  // defined as `success`'s green), and it renders at full strength here.
                  className="text-info hover:text-info/80 disabled:pointer-events-none disabled:opacity-50"
                />
              }
            >
              <ClipboardList className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </TooltipTrigger>
            <TooltipContent>View the plan</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onStartPlan}
                  disabled={busy}
                  aria-label={`Create a plan for ${ticket.title}`}
                  // Light grey, lighter than the row's "4d ago" date, against the view
                  // button's bold blue: a plan yet to be written is the quiet state, an
                  // available action rather than something already there.
                  className="text-muted-foreground/50 hover:text-foreground disabled:opacity-50"
                />
              }
            >
              <ClipboardPlus className="h-4 w-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Plan this ticket — starts a session to write its plan</TooltipContent>
          </Tooltip>
        )}
      </div>
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
        // Same width as the link so the row's right edge — and with it the priority and date
        // columns inside — stays put on a row with no issue to link.
        <span className="w-20 shrink-0" aria-hidden />
      )}
    </li>
  )
}

// The tickets list (#697/#1144): the project's `tickets/*.md` as one-liners — priority, topics,
// what the agent already did to it, and how recently, all on the row — so the backlog is scannable
// without opening one. A row opens its detail page (#1144), which is where Queue and the summary
// live, and carries two direct starts: the start column (an agent implementing the ticket) and the
// plan column (an agent writing its plan, #685). An empty `tickets/` offers to import the repo's
// GitHub issues instead of just saying "nothing here"; a filled one offers to update it (#1208)
// instead of a re-import re-walking the whole backlog.
export function TicketsPanel({
  projectId,
  tickets,
  loaded,
  hiddenByFilter = 0,
  onOpen,
  onOpenPlan,
  onRunStarted,
  onTopicClick,
  onClaimedClick,
  onClearFilters,
}: {
  projectId: string | null
  tickets: WorkspaceTicket[]
  loaded: boolean
  /** How many of this project's tickets the caller's filters hid (#1144/#1230). An empty
   *  `tickets` with some hidden reads as "filtered", not as "nothing here" — the import prompt
   *  offers work that has already been done. */
  hiddenByFilter?: number
  /** Open one ticket's detail page (#1144), by its file — the same slug the route uses. */
  onOpen: (file: string) => void
  /** Open one ticket's plan view (#685), by its file — the plan column's link when a `.plan.md`
   *  already exists. Absent when the caller has no plan route to send the reader to. */
  onOpenPlan?: ((file: string) => void) | undefined
  /** Told when the import session starts, so the shell can show it (#948) — the button used
   *  to flip "Starting…" and leave you staring at the still-empty panel. */
  onRunStarted?: ((intent: string, runId?: string) => void) | undefined
  /** Click-to-filter (#1144), threaded to every row; absent on a page with no filters. */
  onTopicClick?: ((topic: string) => void) | undefined
  onClaimedClick?: (() => void) | undefined
  /** Lets the "N hidden by filters" state clear them right there instead of pointing back up
   *  at the toolbar. */
  onClearFilters?: (() => void) | undefined
}) {
  const { busy, error, run } = useAction()
  // When `tickets/` last caught up with GitHub. Read here rather than passed down: the cross-
  // project page reads one ticket list per project, and this is the one extra read a section adds.
  const meta = useLoaded<TicketsMeta>(projectId ? () => onTicketsMeta(projectId) : null, NO_META, [projectId])

  if (!projectId) return null
  if (!loaded) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  const startSession = async (prompt: string, failure: string, options: { unattended?: boolean; ticket?: string } = {}) => {
    const result = await run(() => sendStart(projectId, prompt, 'prompt', options), failure)
    // Jump to the session doing the work, so its progress is watchable instead of the panel
    // sitting on stale rows until files land.
    if (result?.ok) onRunStarted?.(prompt, result.runId)
  }

  // Unattended (#1279): an import/update fired by a button is routine work, not a conversation — it
  // ends at settle and its armed handoff fires, as when the sweep starts the same routine.
  const importFromGithub = () => startSession(IMPORT_PROMPT, 'The import could not be started.', { unattended: true })
  const updateFromGithub = () => startSession(UPDATE_PROMPT, 'The update could not be started.', { unattended: true })
  // Attended, unlike the imports above: a plan is written per-ticket for a human to read and act
  // on, so the session stays a conversation you land in and steer rather than one that settles and
  // hands itself off. The reader reviews the result through the plan column's link.
  const startPlan = (file: string) => startSession(planPrompt(file), 'The planning session could not be started.')
  // The start column (#855's play button, on the backlog): one agent on this one ticket is the
  // same work the drain sweep starts, so it runs the same way — unattended (#1279), ending at
  // settle with its armed handoff. `ticket` rides on the options so the run's meta names what it
  // implements (#1117) — the prompt is not the drain preset, so the daemon would not infer it.
  const startWork = (file: string) =>
    startSession(workOnTicketPrompt(file), 'The work session could not be started.', { unattended: true, ticket: `tickets/${file}` })

  if (tickets.length === 0 && hiddenByFilter > 0) {
    // Filtered to nothing, not genuinely empty (#1144/#1230): offering an import here would ask
    // for work already done.
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm">
        <p className="text-muted-foreground">
          {hiddenByFilter} ticket{hiddenByFilter === 1 ? '' : 's'} hidden by the current filters.
        </p>
        {onClearFilters && (
          <Button variant="outline" size="xs" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
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
          <TicketRow
            key={ticket.file}
            ticket={ticket}
            busy={busy}
            onOpen={() => onOpen(ticket.file)}
            onStartWork={() => void startWork(ticket.file)}
            onOpenPlan={onOpenPlan ? () => onOpenPlan(ticket.file) : undefined}
            onStartPlan={() => void startPlan(ticket.file)}
            onTopicClick={onTopicClick}
            onClaimedClick={onClaimedClick}
          />
        ))}
      </ul>
    </div>
  )
}
