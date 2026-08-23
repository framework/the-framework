import { useMemo, useState } from 'react'
import type { ProjectTickets } from '../../src/index.js'
import { onAllTickets } from '../rpc/reads.js'
import { sendStart } from '../rpc/control.js'
import { usePolled } from '../lib/use-async.js'
import { useAction } from '../lib/use-action.js'
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
import { TicketFilterBar } from './TicketFilterBar.js'
import { TicketsPanel, TicketRow, planPrompt, workOnTicketPrompt } from './TicketsPanel.js'

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
// anywhere".
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
  const addTopic = (topic: string) => {
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
    const prompt = planPrompt(file)
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

  // A project deselected in the Project facet disappears entirely — its section would otherwise
  // just say "N hidden by filters", which is noise about a choice the reader made on purpose.
  const shownGroups = view.filters.projects.length > 0 ? groups.filter(g => view.filters.projects.includes(g.projectId)) : groups
  const flatRows = sortRows(visible, view.sort)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-border px-6 py-3">
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
              {error && <p className="text-xs text-danger">{error}</p>}
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
