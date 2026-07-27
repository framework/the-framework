import type { DashboardData, Intervention } from '@gemstack/the-framework'
import { GitBranch, GitPullRequest, Inbox, MessageCircleQuestion } from 'lucide-react'
import { onDashboard } from '../server/reads.telefunc.js'
import { interventionKey } from '@gemstack/the-framework/client'
import { Quota } from './Quota.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { usePolled } from '../lib/use-async.js'
import { usePreferences } from '../lib/preferences.js'
import { OnboardingChecklist } from './OnboardingChecklist.js'
import { HotTickets } from './HotTickets.js'
import { RoutineWork } from './RoutineWork.js'
import { Agents } from './Agents.js'
import { AiQueue } from './AiQueue.js'
import { ScrollArea } from './ui/scroll-area.js'

// The Overview landing page (#1139): a focused at-a-glance board — usage first, then what needs a
// human (Human Queue) beside the agents working now stacked on what the AI takes up next (AI
// Queue), the routine jobs, and the hot tickets across every project. Each section is a projection
// of the same .the-framework files over the `onDashboard` Telefunc read, polled so it stays live;
// selecting a row jumps into its project or straight into a session. Shown by the shell when no
// project is picked.
//
// It replaced the denser board this started as (#471) — KPI tiles, a two-week activity chart, run
// outcomes, and a projects table — cut here as redundant (#1139); the activity chart is meant to
// return later.
export function DashboardPage({
  onSelectProject,
  onSelectRun,
  onOpenTicket,
  onRunStarted,
  interventions,
}: {
  onSelectProject: (id: string) => void
  /** Open one session (project + run): the Agents and hot-ticket rows link straight to a session. */
  onSelectRun: (projectId: string, runId: string) => void
  /** Open one ticket's own page (#1144): a queued entry links to its ticket, so its row does too. */
  onOpenTicket: (projectId: string, file: string) => void
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

        {/* The two queues side by side (#1139), with the agents working now sitting to the Human
            Queue's right on top of the AI Queue: what needs you, who is on it, and what the AI
            takes up next. */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <HumanQueue items={interventions} onSelectProject={onSelectProject} onSelectRun={onSelectRun} />
          <div className="space-y-4">
            <Agents working={data?.active ?? []} loading={loading} onSelectRun={onSelectRun} />
            <AiQueue queue={data?.queue ?? []} loading={loading} onOpenTicket={onOpenTicket} onRunStarted={onRunStarted} />
          </div>
        </div>

        {/* Routine work sits below the AI Queue (#1139/#1159): the scheduled jobs and the button
            that fires one now. */}
        <RoutineWork onRunStarted={onRunStarted} />

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
function HumanQueue({
  items,
  onSelectProject,
  onSelectRun,
}: {
  items: Intervention[]
  onSelectProject: (id: string) => void
  onSelectRun: (projectId: string, runId: string) => void
}) {
  // Awaiting and unpushed both name a run (#636/#860), so the row opens that session — which is what
  // its "Open the session" promise says. Only if the id is somehow absent does it fall back to the
  // project, rather than doing nothing.
  const openSession = (item: Intervention) =>
    item.runId ? onSelectRun(item.projectId, item.runId) : onSelectProject(item.projectId)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Human Queue
          {items.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
              {items.length}
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Agents awaiting your approval, review, or input</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">AI doesn&apos;t need you.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(item => (
              <li key={interventionKey(item)}>
                {item.kind === 'awaiting' ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => openSession(item)}
                          className="flex w-full items-center gap-2.5 py-2 text-left hover:opacity-80"
                        />
                      }
                    >
                      <MessageCircleQuestion className="h-4 w-4 shrink-0 text-warning" />
                      <span className="shrink-0 text-xs font-medium text-warning">Awaiting</span>
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                    </TooltipTrigger>
                    <TooltipContent>Open the session to answer</TooltipContent>
                  </Tooltip>
                ) : item.kind === 'unpushed' ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => openSession(item)}
                          className="flex w-full items-center gap-2.5 py-2 text-left hover:opacity-80"
                        />
                      }
                    >
                      <GitBranch className="h-4 w-4 shrink-0 text-info" />
                      <span className="shrink-0 text-xs font-medium text-info">Unpushed</span>
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      {/* An unknown count says nothing rather than the contradictory "0 commits". */}
                      {item.commits !== undefined && item.commits > 0 && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {item.commits === 1 ? '1 commit' : `${item.commits} commits`}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`Open the session: work on ${item.branch ?? ''} was never pushed`}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 py-2 hover:opacity-80"
                        />
                      }
                    >
                      <GitPullRequest className="h-4 w-4 shrink-0 text-success" />
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">#{item.number}</span>
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.projectName}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`Open PR #${item.number} on GitHub`}</TooltipContent>
                  </Tooltip>

                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
