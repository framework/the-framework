import { Card, CardContent, CardHeader, CardTitle, Tooltip, TooltipContent, TooltipTrigger, cn, formatAge, formatDateTime, useModuleHost, usePolled, type ModuleCardProps } from 'framework/module'
import { readSchedulers, schedulerStatus, type SchedulerRow } from './schedulers.js'

// The Overview's Scheduler card: the scheduler of every project that has this package, read with
// `agent-scheduler status` every 10 seconds. One row per project: whether the scheduler is on and
// its process alive, its model, and what the last tick decided, in the tool's own words. A decision
// that started a run opens that agent.
//
// No buttons. The scheduler is started and stopped by the project's own hooks when the dashboard
// opens and closes, and by hand from the command line.

const EMPTY: SchedulerRow[] = []

export function SchedulerCard({ projects }: ModuleCardProps) {
  const host = useModuleHost()
  const key = projects.map(p => p.id).join(',')
  const { value: rows, loaded } = usePolled(() => readSchedulers(host, projects), EMPTY, 10_000, [key])
  if (projects.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scheduler</CardTitle>
        <p className="text-xs text-muted-foreground">Agents started on a schedule while nobody is at the keyboard, per project</p>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(row => {
              const status = schedulerStatus(row)
              return (
                <li key={row.project.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{row.project.name}</span>
                    <span className={cn('shrink-0 text-xs font-medium', status.tone)}>{status.label}</span>
                    {row.keepAlive && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">keep-alive</span>}
                    {row.model && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{row.model}</span>}
                  </div>
                  {row.error !== undefined && <p className="mt-1 pl-0.5 text-xs text-muted-foreground">{row.error}</p>}
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
                                <button type="button" onClick={() => host.openAgent(row.project.id, d.run!)} className="min-w-0 truncate text-left hover:text-foreground hover:underline">
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
