import type { ProjectScheduler } from '../../src/index.js'
import { Clock } from 'lucide-react'
import { onSchedulers } from '../rpc/reads.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { usePolled } from '../lib/use-async.js'
import { formatAge, formatDateTime } from '../lib/format-date.js'
import { cn } from '../lib/utils.js'

// The Overview's scheduler card (#1774): every registered project's scheduler, a projection of the
// `.agent-scheduler/state.json` each project's scheduler writes, polled so it stays live. One row
// per project: whether the scheduler is on and its process alive, its model, and what the last tick
// decided, in the tool's own words. A decision that started a run opens that agent.
//
// No buttons. The scheduler is started and stopped by the project's own hooks when the dashboard
// opens and closes, and by hand from the command line; a Start button here would make the dashboard
// name the tool, which the hook exists to avoid.

const EMPTY: ProjectScheduler[] = []

/** The one word the row leads with, and its colour. */
export function schedulerStatus(row: ProjectScheduler): { label: string; tone: string } {
  if (!row.present) return { label: 'not set up', tone: 'text-muted-foreground' }
  if (!row.on) return { label: 'off', tone: 'text-muted-foreground' }
  if (!row.running) return { label: 'on, not running', tone: 'text-warning' }
  return { label: 'on', tone: 'text-success' }
}

export function SchedulerCard({ onSelectAgent }: { onSelectAgent: (projectId: string, agentId: string) => void }) {
  const { value: rows, loaded } = usePolled(onSchedulers, EMPTY, 5000, [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Scheduler
        </CardTitle>
        <p className="text-xs text-muted-foreground">Agents started on a schedule while nobody is at the keyboard, per project</p>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No projects.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(row => {
              const status = schedulerStatus(row)
              return (
                <li key={row.projectId}>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{row.projectName}</span>
                    <span className={cn('shrink-0 text-xs font-medium', status.tone)}>{status.label}</span>
                    {row.keepAlive && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">keep-alive</span>}
                    {row.model && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{row.model}</span>}
                  </div>
                  {row.lastTick && (
                    <div className="mt-1 pl-0.5 text-xs text-muted-foreground">
                      <p>
                        last tick{' '}
                        <Tooltip>
                          <TooltipTrigger render={<span className="tabular-nums" />}>{formatAge(row.lastTick.at)}</TooltipTrigger>
                          <TooltipContent>{formatDateTime(row.lastTick.at)}</TooltipContent>
                        </Tooltip>
                        {row.lastTick.note && `: ${row.lastTick.note}`}
                      </p>
                      {row.lastTick.decisions.length > 0 && (
                        <ul className="mt-0.5 space-y-0.5">
                          {row.lastTick.decisions.map((d, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span aria-hidden className="text-muted-foreground/50">•</span>
                              {/* A decision that started a run names the agent, so the line opens it. */}
                              {d.run ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectAgent(row.projectId, d.run!)}
                                  className="min-w-0 truncate text-left hover:text-foreground hover:underline"
                                >
                                  {d.command}: {d.outcome}
                                </button>
                              ) : (
                                <span className="min-w-0 truncate">
                                  {d.command}: {d.outcome}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
