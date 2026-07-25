import type { DashboardData, ActiveRun, ProjectQueue, RecentRun, Intervention } from '@gemstack/the-framework'
import { Bot, GitBranch, GitPullRequest, Inbox, ListTodo, MessageCircleQuestion } from 'lucide-react'
import { onDashboard } from '../server/reads.telefunc.js'
import { interventionKey } from '@gemstack/the-framework/client'
import { Quota } from './Quota.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { usePolled } from '../lib/use-async.js'
import { usePreferences } from '../lib/preferences.js'
import { OnboardingChecklist } from './OnboardingChecklist.js'
import { HotTickets } from './HotTickets.js'
import { RoutineWork } from './RoutineWork.js'
import { queueEntryLabel } from '../lib/queue-entry.js'
import { runLabel } from '../lib/run-label.js'
import { formatAge, formatDateTime } from '../lib/format-date.js'
import { ScrollArea } from './ui/scroll-area.js'

// The Overview landing page (#1139): a focused at-a-glance board — usage first, then the two queues
// (what needs a human, what the AI takes up next) side by side, the routine jobs, the agents working
// now and just finished, and the hot tickets across every project. Each section is a projection of
// the same .the-framework files over the `onDashboard` Telefunc read, polled so it stays live;
// selecting a row jumps into its project or straight into a session. Shown by the shell when no
// project is picked.
//
// It replaced the denser board this started as (#471) — KPI tiles, a two-week activity chart, run
// outcomes, and a projects table — cut here as redundant (#1139); the activity chart is meant to
// return later.
export function DashboardPage({
  onSelectProject,
  onSelectRun,
  onRunStarted,
  interventions,
}: {
  onSelectProject: (id: string) => void
  /** Open one session (project + run): the Agents and hot-ticket rows link straight to a session. */
  onSelectRun: (projectId: string, runId: string) => void
  /** Where a session the onboarding checklist starts lands (#1169): on that session. */
  onRunStarted: (projectId: string, intent: string, runId?: string) => void
  interventions: Intervention[]
}) {
  const { value: data } = usePolled<DashboardData | null>(onDashboard, null, 5000, [])
  // Dismissing only hides it here (#958); the settings page keeps it, which is what the
  // dismiss control says.
  const onboardingDismissed = usePreferences().onboardingDismissed ?? false
  const loading = data === null

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {!onboardingDismissed && <OnboardingChecklist dismissible onRunStarted={onRunStarted} />}

        {/* Usage first (#1139): the one figure that governs everything the agent may do next. */}
        <Quota />

        {/* The two queues side by side (#1139): what needs you, and what the AI takes up next. */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <HumanQueue items={interventions} onSelectProject={onSelectProject} />
          <AiQueue queue={data?.queue ?? []} loading={loading} onSelectProject={onSelectProject} />
        </div>

        {/* Routine work sits below the AI Queue (#1139/#1159): the scheduled jobs and the button
            that fires one now. */}
        <RoutineWork onSelectProject={onSelectProject} />

        <Agents working={data?.active ?? []} finished={data?.recentAgents ?? []} loading={loading} onSelectRun={onSelectRun} />

        <HotTickets onSelectProject={onSelectProject} onSelectRun={onSelectRun} />
      </div>
    </ScrollArea>
  )
}

// The Human Queue (#632/#1139): the cross-project things only a person can clear. Three kinds: open
// PRs to review (proposals and finished work both surface as PRs) — merge to confirm, close to
// reject, so each links straight out to its PR; runs paused mid-flight on a question (#636), which
// jump into that project's live view to answer; and work a finished session left unpushed. #627
// notifications fire off the same set.
function HumanQueue({ items, onSelectProject }: { items: Intervention[]; onSelectProject: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Human Queue
          {items.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {items.length}
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">Agents awaiting your approval, review, or input</p>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">AI doesn&apos;t need you.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(item => (
              <li key={interventionKey(item)}>
                {item.kind === 'awaiting' ? (
                  <button
                    type="button"
                    onClick={() => onSelectProject(item.projectId)}
                    className="flex w-full items-center gap-2 py-2 text-left hover:opacity-80"
                    title="Open the session to answer"
                  >
                    <MessageCircleQuestion className="h-4 w-4 shrink-0 text-warning" />
                    <span className="shrink-0 text-xs font-medium text-warning">Awaiting</span>
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                  </button>
                ) : item.kind === 'unpushed' ? (
                  <button
                    type="button"
                    onClick={() => onSelectProject(item.projectId)}
                    className="flex w-full items-center gap-2 py-2 text-left hover:opacity-80"
                    title={`Open the session: work on ${item.branch ?? ''} was never pushed`}
                  >
                    <GitBranch className="h-4 w-4 shrink-0 text-info" />
                    <span className="shrink-0 text-xs font-medium text-info">Unpushed</span>
                    <span className="truncate font-medium">{item.title}</span>
                    {/* An unknown count says nothing rather than the contradictory "0 commits". */}
                    {item.commits !== undefined && item.commits > 0 && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {item.commits === 1 ? '1 commit' : `${item.commits} commits`}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                  </button>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 py-2 hover:opacity-80"
                    title={`Open PR #${item.number} on GitHub`}
                  >
                    <GitPullRequest className="h-4 w-4 shrink-0 text-success" />
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">#{item.number}</span>
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// The AI Queue (#1139): every project's open `TODO_AGENTS.md` items — the work the framework picks
// up on its own — grouped by project and shown in full. No "+N more": this is the plan, and a
// collapsed plan is one you cannot read. Bullets, not checkboxes: nothing here is yours to tick off.
function AiQueue({
  queue,
  loading,
  onSelectProject,
}: {
  queue: ProjectQueue[]
  loading: boolean
  onSelectProject: (id: string) => void
}) {
  const withOpen = queue.filter(q => q.open > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          AI Queue
        </CardTitle>
        <p className="text-sm text-muted-foreground">Tasks AI will work on next</p>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : withOpen.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing queued.</p>
        ) : (
          <ul className="space-y-3">
            {withOpen.map(q => (
              <li key={q.projectId}>
                <button
                  type="button"
                  onClick={() => onSelectProject(q.projectId)}
                  className="flex w-full items-center gap-2 text-left hover:opacity-80"
                >
                  <span className="truncate text-sm font-medium">{q.projectName}</span>
                  <span className="ml-auto shrink-0 rounded-full border border-border px-2 text-xs text-muted-foreground">{q.open}</span>
                </button>
                <ul className="mt-1 space-y-0.5 pl-1">
                  {q.items
                    .filter(i => !i.done)
                    .map((item, i) => {
                      // The line is markdown, and a queued ticket is written as a link to it (#1164),
                      // so print the title rather than the source; the whole line stays in the tooltip.
                      const label = queueEntryLabel(item.text)
                      return (
                        <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                          <span aria-hidden className="text-muted-foreground/60">•</span>
                          <span className="truncate" title={item.text}>{label.text}</span>
                        </li>
                      )
                    })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** One agent row's data, shared by the Current and Recent columns. */
interface AgentRowData {
  key: string
  /** The session's one-liner, the same the sidebar shows. */
  label: string
  /** ISO: last activity for a working agent, finish time for a finished one. */
  at: string | undefined
  projectName: string
  onOpen: () => void
}

// The Agents view (#1139): sessions working now (Current) and just finished (Recent), side by side.
// Each row is the whole line, clickable straight into that session — its label is the one-liner the
// sidebar shows (runLabel), and its age reads "22s ago" with the exact moment on hover. This is what
// replaced the old "Working now" list.
function Agents({
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
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Agents
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{heading}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
      {loading ? (
        <p className="py-2 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
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
      <button
        type="button"
        onClick={onOpen}
        title="Open this session"
        className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        <span aria-hidden className="shrink-0 text-muted-foreground/60">•</span>
        <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{projectName}</span>
        {at && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title={formatDateTime(at)}>
            {formatAge(at)}
          </span>
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
