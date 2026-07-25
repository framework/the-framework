import type { ActiveRun, RecentRun } from '@gemstack/the-framework'
import { Bot } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { runLabel } from '../lib/run-label.js'
import { formatAge, formatDateTime } from '../lib/format-date.js'

// The Overview's Agents card (#1139): sessions working now (Current) and just finished (Recent),
// side by side. Each row is the whole line, clickable straight into that session — its label is the
// one-liner the sidebar shows (runLabel), and its age reads "22s ago" with the exact moment on
// hover. This is what replaced the old "Working now" list.
//
// Its own file rather than inline in DashboardPage, like every other card on the Overview: opening
// a session from here is the behaviour #1189 exists to protect, and DashboardPage has no test file
// to pin it in.

/** One row: a session, and what opening it does. */
interface AgentRowData {
  key: string
  /** The session's one-liner, the same the sidebar shows. */
  label: string
  /** ISO: last activity for a working agent, finish time for a finished one. */
  at: string | undefined
  projectName: string
  onOpen: () => void
}

export function Agents({
  working,
  finished,
  loading,
  onSelectRun,
}: {
  working: ActiveRun[]
  finished: RecentRun[]
  loading: boolean
  onSelectRun: (projectId: string, runId: string) => void
}) {
  const current: AgentRowData[] = working.map(a => ({
    key: `${a.projectId}:${a.runId}`,
    label: activeLabel(a),
    at: a.updatedAt,
    projectName: a.projectName,
    onOpen: () => onSelectRun(a.projectId, a.runId),
  }))
  const recent: AgentRowData[] = finished.map(f => ({
    key: `${f.projectId}:${f.run.id}`,
    label: runLabel(f.run),
    at: f.run.updatedAt,
    projectName: f.projectName,
    onOpen: () => onSelectRun(f.projectId, f.run.id),
  }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Agents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          <AgentColumn heading="Current" description="Agents currently working" rows={current} loading={loading} empty="No agents working right now." />
          <AgentColumn heading="Recent" description="Agents finished working" rows={recent} loading={loading} empty="No sessions yet." />
        </div>
      </CardContent>
    </Card>
  )
}

function AgentColumn({
  heading,
  description,
  rows,
  loading,
  empty,
}: {
  heading: string
  description: string
  rows: AgentRowData[]
  loading: boolean
  empty: string
}) {
  return (
    <div className="min-w-0">
      {/* Eyebrow + one-line description on a single ruled row, so the column reads as a labelled
          section rather than two stacked muted lines. */}
      <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
        <h4 className="shrink-0 text-xs font-semibold uppercase tracking-wide text-foreground">{heading}</h4>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      {loading ? (
        <p className="py-2 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {rows.map(r => (
            <AgentRow key={r.key} label={r.label} at={r.at} projectName={r.projectName} onOpen={r.onOpen} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AgentRow({ label, at, projectName, onOpen }: Omit<AgentRowData, 'key'>) {
  return (
    <li>
      {/* No hint on the row itself: that a session row opens the session is the one thing this card
          says already, and a tooltip on the row would sit over the one on the age (#1149). */}
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        <span aria-hidden className="shrink-0 text-muted-foreground/50">•</span>
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{projectName}</span>
        {at && (
          <Tooltip>
            <TooltipTrigger
              render={<span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground/80" />}
            >
              {formatAge(at)}
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(at)}</TooltipContent>
          </Tooltip>
        )}
      </button>
    </li>
  )
}

// A working session's one-liner: what the sidebar would show for it. ActiveRun carries no branch or
// start time to fall back to, but a live session almost always has an intent or a chosen name; its
// project is the last resort.
function activeLabel(a: ActiveRun): string {
  return a.intent?.trim() || a.sessionName?.trim() || a.scope?.trim() || a.projectName
}
