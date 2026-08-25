import { useMemo, useState } from 'react'
import { Check, ClipboardPlus, ListPlus } from 'lucide-react'
import type { ProjectTickets, WorkspaceTicket } from '../../src/index.js'
import { planTicketPrompt } from '../../src/client.js'
import { onAllTickets, onQueue } from '../rpc/reads.js'
import { sendQueueTicket, sendQueueTicketPlan, sendStart } from '../rpc/control.js'
import { usePolled } from '../lib/use-async.js'
import { useAction } from '../lib/use-action.js'
import { queueEntryLabel } from '../lib/queue-entry.js'
import {
  defaultView,
  filterRows,
  flattenTickets,
  formatTicketsView,
  hasAnyFilter,
  parseTicketsView,
  sortRows,
  type TicketsView,
} from '../lib/ticket-filter.js'
import { ScrollArea } from './ui/scroll-area.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { TicketFilterBar } from './TicketFilterBar.js'
import { TicketsPanel, TicketRow, workOnTicketPrompt } from './TicketsPanel.js'

/** Stable initial for the cross-project tickets poll, so it does not churn on every render. */
const EMPTY_GROUPS: ProjectTickets[] = []

/** The view the page opens with: whatever the URL says (#784's doctrine — the URL is the
 *  selection, filters included), or the defaults where there is no URL to read. */
function initialView(): TicketsView {
  return typeof window === 'undefined' ? defaultView() : parseTicketsView(window.location.search)
}

// The Tickets view (#1144): every registered project's `tickets/*.md`, one section per project —
// its own full page rather than a tab squeezed into the 22rem right rail, and cross-project rather
// than scoped to whichever project happened to be selected, since the backlog is worth seeing
// whole. Filtering/sorting/grouping (#1144) all live in one URL-carried TicketsView: search,
// faceted filters (priority/topics/stage/effort/uncertainty/project/unlinked), sort with
// direction, and Group by project (each section its own poll-independent TicketsPanel) vs a flat
// cross-project list — the one view that can answer "what is the single highest-priority ticket
// anywhere". Rows are selectable (GitHub's list idiom): while any shown row is ticked, the
// heading's queue buttons narrow from the whole shown set to just the selected tickets.
export function TicketsPage({
  onOpenTicket,
  onOpenTicketPlan,
  onAgentStarted,
}: {
  /** Open one ticket's detail page (#1144), by its project and file. */
  onOpenTicket: (projectId: string, file: string) => void
  /** Open one ticket's plan view (#685), by its project and file — the plan column's link. */
  onOpenTicketPlan?: ((projectId: string, file: string) => void) | undefined
  /** Told when an import/update session starts, so the shell can show it (#948) — which project
   *  started it is not implied the way it is for a single-project page, so each section binds
   *  its own id below rather than this prop guessing. */
  onAgentStarted?: ((projectId: string, intent: string, agentId?: string) => void) | undefined
}) {
  const { value: groups, loaded } = usePolled<ProjectTickets[]>(onAllTickets, EMPTY_GROUPS, 10_000, [])
  const [view, setViewState] = useState<TicketsView>(initialView)

  // Every view change mirrors into the query string — replaceState, not a navigation: filters are
  // page state the Back button should step over, not through, and the address stays shareable.
  const setView = (next: TicketsView) => {
    setViewState(next)
    if (typeof window !== 'undefined') {
      const qs = formatTicketsView(next)
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }
  const clearFilters = () => setView({ ...view, filters: defaultView().filters })
  // Click-to-filter (#1144): a row's topic badge adds its topic, the claim marker narrows to
  // claimed — additive, so clicking a second topic widens the OR instead of replacing it.
  // Lowercased on the way in, the one casing the filters hold (the query-string parser does the
  // same): matching lowercases the ticket's own topics, so a badge reading `UX` filtered nothing.
  const addTopic = (raw: string) => {
    const topic = raw.toLowerCase()
    if (!view.filters.topics.includes(topic)) setView({ ...view, filters: { ...view.filters, topics: [...view.filters.topics, topic] } })
  }
  const filterClaimed = () => {
    if (!view.filters.stage.includes('claimed'))
      setView({ ...view, filters: { ...view.filters, stage: [...view.filters.stage, 'claimed'] } })
  }

  const rows = useMemo(() => flattenTickets(groups), [groups])
  const visible = filterRows(rows, view.filters)
  const filtered = hasAnyFilter(view.filters)

  // Flat mode renders rows outside any TicketsPanel, so the plan and start columns need their own
  // actions with the row's own project (a panel binds one projectId; the flat list has one per row).
  const { busy, error, run } = useAction()
  const startPlan = async (projectId: string, file: string) => {
    const prompt = planTicketPrompt(file)
    const result = await run(() => sendStart(projectId, prompt, 'prompt'), 'The planning agent could not be started.')
    if (result?.ok) onAgentStarted?.(projectId, prompt, result.agentId)
  }
  // Unattended with the ticket named on the options, exactly as the panel's own start column does.
  const startWork = async (projectId: string, file: string) => {
    const prompt = workOnTicketPrompt(file)
    const result = await run(
      () => sendStart(projectId, prompt, 'prompt', { unattended: true, ticket: `tickets/${file}` }),
      'The work agent could not be started.',
    )
    if (result?.ok) onAgentStarted?.(projectId, prompt, result.agentId)
  }
  // The page-wide queue-adds: every unclaimed shown ticket joins the AI queue — the work the
  // framework picks up on its own — as an implementation entry, or as the [Plan tickets]
  // preset's own plan ask. Both walk the shown order, so within a priority section entries keep
  // the order the reader saw; both read the queue at click time and leave alone what is already
  // there ("add" means the set ends up queued — a duplicate entry would outlive its agent's
  // check-off as an open entry naming a closed ticket, costing the sweep an agent). No agent
  // starts here — the queue is what the routine drain fans out over (#1204) and what the queue
  // card's play buttons work one entry at a time (#855). Each stops at the first failure; the
  // daemon's own reason lands in `error`, and everything already queued stays.

  /** The open queue as both queue-adds dedupe against it, read at click time: every open
   *  entry's exact text, and the tickets implementation entries link to — per project. */
  const readOpenQueue = async () => {
    const texts = new Set<string>()
    const tickets = new Set<string>()
    for (const q of await onQueue())
      for (const item of q.items) {
        if (item.done) continue
        texts.add(`${q.projectId}\n${item.text.trim()}`)
        const file = queueEntryLabel(item.text).ticket
        if (file) tickets.add(`${q.projectId}\n${file}`)
      }
    return { texts, tickets }
  }

  // Queue the tickets themselves, exactly as the detail page's Queue action queues one (#1164):
  // title as the entry, linked back to the ticket, its priority picking the section.
  const [queuedKey, setQueuedKey] = useState<string | null>(null)
  const queueShownTickets = async (targets: { projectId: string; ticket: WorkspaceTicket }[], key: string) => {
    const done = await run(async () => {
      const open = await readOpenQueue()
      for (const { projectId, ticket } of targets) {
        if (open.tickets.has(`${projectId}\n${ticket.file}`)) continue
        const queued = await sendQueueTicket(projectId, ticket.title, {
          file: ticket.file,
          ...(ticket.priority ? { priority: ticket.priority } : {}),
        })
        if (!queued.ok) return { ok: false as const, error: queued.error ?? 'The tickets could not be queued.' }
      }
      return { ok: true as const }
    }, 'The tickets could not be queued.')
    if (done?.ok) setQueuedKey(key)
  }

  // Queue the tickets' PLANS: one `Create tickets/<stem>.plan.md` entry each — the [Plan
  // tickets] preset's own ask, recognized by its exact text — so a drain agent reaching the
  // entry writes the plan. A ticket whose plan ask is already queued is skipped by that text;
  // one queued for implementation is skipped too, since its work would land before a trailing
  // plan could matter.
  const [plansQueuedKey, setPlansQueuedKey] = useState<string | null>(null)
  const queueShownPlans = async (targets: { projectId: string; ticket: WorkspaceTicket }[], key: string) => {
    const done = await run(async () => {
      const open = await readOpenQueue()
      for (const { projectId, ticket } of targets) {
        if (open.texts.has(`${projectId}\n${planTicketPrompt(ticket.file)}`)) continue
        if (open.tickets.has(`${projectId}\n${ticket.file}`)) continue
        const queued = await sendQueueTicketPlan(projectId, {
          file: ticket.file,
          ...(ticket.priority ? { priority: ticket.priority } : {}),
        })
        if (!queued.ok) return { ok: false as const, error: queued.error ?? 'The plans could not be queued.' }
      }
      return { ok: true as const }
    }, 'The plans could not be queued.')
    if (done?.ok) setPlansQueuedKey(key)
  }

  // A project deselected in the Project facet disappears entirely — its section would otherwise
  // just say "N hidden by filters", which is noise about a choice the reader made on purpose.
  const shownGroups = view.filters.projects.length > 0 ? groups.filter(g => view.filters.projects.includes(g.projectId)) : groups
  const flatRows = sortRows(visible, view.sort)

  // The row selection (GitHub's list idiom): tick some rows and the queue buttons narrow to just
  // them. Keyed project + file, since the page spans projects and two projects can share a
  // filename. Only shown selected rows count — a selected ticket the filters hide is neither
  // acted on nor counted, and comes back with its row — so what the buttons act on is always
  // visible below. A key whose ticket is gone lingers in the set harmlessly: it intersects
  // nothing shown.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const toggleSelected = (key: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const selectedShown = flatRows.filter(r => selected.has(`${r.projectId}/${r.ticket.file}`))
  const hasSelection = selectedShown.length > 0

  // What the queue-add buttons act on — the shown rows, narrowed to the selected ones the moment
  // any row is selected, minus what each add would waste. Both skip claimed tickets: a ticket
  // some agent already holds (#1420) is being worked, and its entry would outlive that work as
  // queue noise. The plan add also skips planned tickets, whose plan already exists. In the
  // shown order, each row carrying its own project, so a cross-project view needs no special
  // case: every entry lands on its own project's queue.
  const scope = hasSelection ? selectedShown : flatRows
  const targets = scope.filter(r => !r.ticket.locked)
  const claimedShown = scope.length - targets.length
  const planTargets = targets.filter(r => !r.ticket.planned)
  const planSkipped = scope.length - planTargets.length
  // One flip per acted-on set and per button: once this exact set is queued the button says so and
  // rests, and any change to the set — a filter, a poll bringing new tickets, a selection — arms
  // it again.
  const queueKey = targets.map(r => `${r.projectId}/${r.ticket.file}`).join('\n')
  const queuedShown = queuedKey === queueKey
  const planKey = planTargets.map(r => `${r.projectId}/${r.ticket.file}`).join('\n')
  const plansQueuedShown = plansQueuedKey === planKey
  // The labels count what the click adds — saying "selected" while a selection narrows the
  // buttons, and stopping saying "all" the moment their count differs from the set's tally,
  // never promising a ticket they will skip.
  const queueLabel = hasSelection
    ? targets.length === 1
      ? `Add the ${claimedShown > 0 ? 'one unclaimed ' : ''}selected ticket to the AI queue`
      : claimedShown > 0
        ? `Add the ${targets.length} unclaimed selected tickets to the AI queue`
        : `Add the ${targets.length} selected tickets to the AI queue`
    : targets.length === 1
      ? `Add the ${claimedShown > 0 ? 'one unclaimed ' : ''}ticket shown below to the AI queue`
      : claimedShown > 0
        ? `Add the ${targets.length} unclaimed tickets shown below to the AI queue`
        : `Add all ${targets.length} tickets shown below to the AI queue`
  const planLabel = hasSelection
    ? planTargets.length === 1
      ? `Queue a plan for the ${planSkipped > 0 ? 'one unplanned ' : ''}selected ticket`
      : planSkipped > 0
        ? `Queue plans for the ${planTargets.length} unplanned selected tickets`
        : `Queue plans for the ${planTargets.length} selected tickets`
    : planTargets.length === 1
      ? `Queue a plan for the ${planSkipped > 0 ? 'one unplanned ' : ''}ticket shown below`
      : planSkipped > 0
        ? `Queue plans for the ${planTargets.length} unplanned tickets shown below`
        : `Queue plans for all ${planTargets.length} tickets shown below`

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="text-base font-semibold">
              Tickets
              {/* Shown/total beside the name it counts (#1144 follow-up) — it describes the page's
                  content, not the toolbar's controls. Unfiltered it reads n/n, doubling as the
                  backlog's total, which the page otherwise says nowhere. */}
              {loaded && rows.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {visible.length}/{rows.length}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              Every project&apos;s <code className="rounded bg-muted px-1">tickets/</code> backlog — what the agent plans from.
            </p>
          </div>
          {/* The whole shown set onto the queue — or, with rows ticked, just the selected ones:
              the detail page's Queue action lifted to the page, and its plan sibling — the [Plan
              tickets] preset's entries for the same set. Each renders only when it has something
              to add — "all 0 tickets" is not an offer, the list below already explains an empty
              set, and an all-claimed (or, for plans, all-planned) one has nothing left to ask
              for. */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {/* The selection's own readout and exit: while any row is ticked the buttons stop
                speaking for the shown set, so the count says what took over and the clear hands
                the page back without hunting down every ticked box. */}
            {hasSelection && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {selectedShown.length} selected
                </span>
                <Button variant="outline" size="xs" onClick={() => setSelected(new Set())}>
                  Clear selection
                </Button>
              </span>
            )}
            {loaded && planTargets.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={busy || plansQueuedShown}
                      onClick={() => void queueShownPlans(planTargets, planKey)}
                    />
                  }
                >
                  {plansQueuedShown ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Plans queued
                    </>
                  ) : (
                    <>
                      <ClipboardPlus className="h-3.5 w-3.5" aria-hidden />
                      {planLabel}
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  Each {hasSelection ? 'selected ' : ''}ticket gets its plan asked for on the AI queue — the same &quot;Create tickets/….plan.md&quot; entry the
                  Plan tickets preset queues — worked highest priority first and, within a priority, in the order shown below.
                  Tickets already planned, already queued, or held by an agent stay as they are.
                  {hasSelection && ' The rest of the shown set stays put.'}
                </TooltipContent>
              </Tooltip>
            )}
            {loaded && targets.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      disabled={busy || queuedShown}
                      onClick={() => void queueShownTickets(targets, queueKey)}
                    />
                  }
                >
                  {queuedShown ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Queued
                    </>
                  ) : (
                    <>
                      <ListPlus className="h-3.5 w-3.5" aria-hidden />
                      {queueLabel}
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {`Every ${hasSelection ? 'selected ' : ''}ticket joins the AI queue — the work the framework picks up on its own, worked highest priority first and, within a priority, in the order shown below. A ticket already queued stays as it is.`}
                  {hasSelection && ' The rest of the shown set stays put.'}
                  {claimedShown === 1 && ` The claimed ticket ${hasSelection ? 'selected' : 'shown'} is left to the agent holding it.`}
                  {claimedShown > 1 && ` The ${claimedShown} claimed tickets ${hasSelection ? 'selected' : 'shown'} are left to the agents holding them.`}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {/* Page-level failures land here, above the toolbar, so grouped mode shows them too — the
            header owns an action of its own now, not just the flat rows'. */}
        {error && <p className="text-xs text-danger">{error}</p>}
        <TicketFilterBar
          view={view}
          rows={rows}
          projects={groups.map(g => ({ id: g.projectId, name: g.projectName }))}
          onChange={setView}
        />
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
          ) : view.group === 'none' ? (
            // The flat cross-project list: one pool, one order, rows carrying their project. No
            // per-project Update bars here — those belong to the sections, and grouped mode is a
            // menu click away.
            <div className="space-y-2">
              {filtered && rows.length - visible.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {rows.length - visible.length} ticket{rows.length - visible.length === 1 ? '' : 's'} hidden by the current filters.
                  </span>
                  <Button variant="outline" size="xs" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              )}
              {flatRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {rows.length === 0 ? 'No tickets in any project yet — group by project to import from GitHub.' : 'No tickets match.'}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <ul className="divide-y divide-border">
                    {flatRows.map(r => (
                      <TicketRow
                        key={`${r.projectId}/${r.ticket.file}`}
                        ticket={r.ticket}
                        projectName={r.projectName}
                        busy={busy}
                        selected={selected.has(`${r.projectId}/${r.ticket.file}`)}
                        onToggleSelect={() => toggleSelected(`${r.projectId}/${r.ticket.file}`)}
                        onOpen={() => onOpenTicket(r.projectId, r.ticket.file)}
                        onStartWork={() => void startWork(r.projectId, r.ticket.file)}
                        onOpenPlan={onOpenTicketPlan ? () => onOpenTicketPlan(r.projectId, r.ticket.file) : undefined}
                        onStartPlan={() => void startPlan(r.projectId, r.ticket.file)}
                        onTopicClick={addTopic}
                        onClaimedClick={filterClaimed}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {shownGroups.map(g => {
                const groupRows = visible.filter(r => r.projectId === g.projectId)
                const sorted = sortRows(groupRows, view.sort)
                return (
                  <section key={g.projectId} className="min-w-0 space-y-2">
                    <h2 className="truncate text-sm font-semibold">{g.projectName}</h2>
                    <TicketsPanel
                      projectId={g.projectId}
                      tickets={sorted.map(r => r.ticket)}
                      loaded
                      hiddenByFilter={g.tickets.length - groupRows.length}
                      isSelected={file => selected.has(`${g.projectId}/${file}`)}
                      onToggleSelect={file => toggleSelected(`${g.projectId}/${file}`)}
                      onOpen={file => onOpenTicket(g.projectId, file)}
                      onOpenPlan={onOpenTicketPlan ? file => onOpenTicketPlan(g.projectId, file) : undefined}
                      onAgentStarted={(intent, agentId) => onAgentStarted?.(g.projectId, intent, agentId)}
                      onTopicClick={addTopic}
                      onClaimedClick={filterClaimed}
                      onClearFilters={filtered ? clearFilters : undefined}
                    />
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
