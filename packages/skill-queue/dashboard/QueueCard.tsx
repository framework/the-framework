import { useState } from 'react'
import { FastForward, ListTodo, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, StartAgentButton, Tooltip, TooltipContent, TooltipTrigger, usePolled, useWidgetHost, type WidgetCardProps, type WidgetProject } from 'framework/widget'
import { DEFAULT_FAN_OUT_COUNT, entryLabel, fanOut, fanOutLabel, topEntries, workOnEntryPrompt } from '../src/widget.js'

// The Overview's AI Queue card: every project's open entries, the work agents pick up on their own,
// grouped by project and shown in full. No "+N more": this is the plan, and a collapsed plan is one
// you cannot read. Its data is `queue --local` in each project, the very list an agent reads.
//
// Two ways to act, and they are different acts. The play button beside an entry STARTS it: one
// agent, on that entry alone, and the dashboard lands on the run. The project header carries the
// project's batch act: a fan-out that starts one agent per top entry, as many as the count beside
// it says, each pinned to its own entry, without leaving the Overview. Both are split buttons: the
// chevron beside each hands its prompt to the project's launcher instead of spending an agent on
// the settings the card cannot show.

/** One project's open entries as read, or why the command failed. */
interface ProjectRead {
  project: WidgetProject
  entries: string[]
  error?: string
}

const NOTHING_READ: ProjectRead[] = []

export function QueueCard({ projects }: WidgetCardProps) {
  const host = useWidgetHost()
  const key = projects.map(p => p.id).join(',')
  const { value: reads, loaded } = usePolled<ProjectRead[]>(
    () =>
      Promise.all(
        projects.map(async (project): Promise<ProjectRead> => {
          const result = await host.runCommand(project.id, ['--local'])
          if (!result.ok) return { project, entries: [], error: result.error }
          if (!Array.isArray(result.output)) return { project, entries: [], error: 'the queue command did not print a list' }
          return { project, entries: result.output.filter((entry): entry is string => typeof entry === 'string') }
        }),
      ),
    NOTHING_READ,
    // A local read, no fetch: cheap enough to follow the queue closely.
    10_000,
    [key],
  )
  // Which entry is in flight, keyed by content rather than index: the list is polled and can
  // shift under a click, and only the clicked row's button should spin.
  const [starting, setStarting] = useState<string | null>(null)
  // Which project's fan-out is in flight: a sequence of starts, held as one so a second click
  // cannot slip between two of them.
  const [fanningOut, setFanningOut] = useState<string | null>(null)
  // The count beside each project's fan-out button: per project, since queues differ in depth.
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const inFlight = starting !== null || fanningOut !== null

  const countOf = (projectId: string) => counts[projectId] ?? DEFAULT_FAN_OUT_COUNT

  const startEntry = async (projectId: string, entry: string) => {
    if (inFlight) return
    setStarting(`${projectId}\n${entry}`)
    setError(null)
    // One run on one named entry is a session to watch: the dashboard lands on it.
    const result = await host.startRun(projectId, workOnEntryPrompt(entry))
    setStarting(null)
    if (!result.ok) setError(result.error)
  }

  const fanOutProject = async (read: ProjectRead) => {
    if (inFlight) return
    setFanningOut(read.project.id)
    setError(null)
    // A batch lands nowhere: the runs show in the Agents card above, and the Overview stays.
    const outcome = await fanOut(prompt => host.startRun(read.project.id, prompt, { land: false }), topEntries(read.entries, countOf(read.project.id)))
    setFanningOut(null)
    if (outcome.error !== undefined) setError(outcome.error)
  }

  const shown = reads.filter(read => read.entries.length > 0 || read.error !== undefined)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          AI Queue
        </CardTitle>
        <p className="text-xs text-muted-foreground">Tasks AI will work on next</p>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nothing queued.</p>
        ) : (
          <ul className="space-y-4">
            {shown.map(read => {
              const { project, entries } = read
              const count = Math.min(countOf(project.id), Math.max(entries.length, 1))
              return (
                <li key={project.id}>
                  <div className="flex w-full items-center gap-2">
                    <span className="truncate text-sm font-medium">{project.name}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{entries.length}</span>
                    {entries.length > 0 && (
                      <>
                        {/* The project's batch act: how many, then the button the count qualifies. */}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={countOf(project.id)}
                                aria-label="How many agents to spin up"
                                onChange={event => {
                                  // An emptied box is mid-edit rather than a count: `Number('')` is 0.
                                  const typed = event.target.value.trim()
                                  if (!typed) return
                                  const next = Math.round(Number(typed))
                                  if (!Number.isFinite(next)) return
                                  setCounts(prev => ({ ...prev, [project.id]: Math.max(next, 1) }))
                                }}
                                className="h-7 w-11 shrink-0 rounded border border-border bg-background px-1 text-center text-xs tabular-nums text-foreground"
                              />
                            }
                          />
                          <TooltipContent>How many agents to spin up — one per entry, from the top of the queue.</TooltipContent>
                        </Tooltip>
                        {/* The chevron sends the top entry alone: a launcher can only ever start one agent. */}
                        <StartAgentButton
                          variant="ghost"
                          size="icon-sm"
                          icon={<FastForward className="h-3.5 w-3.5" aria-hidden />}
                          ariaLabel={fanOutLabel(count)}
                          menuAriaLabel={`Other ways to spin up agents on ${project.name}'s queue`}
                          tooltip={fanOutLabel(count)}
                          busy={inFlight}
                          starting={fanningOut === project.id}
                          onStart={() => void fanOutProject(read)}
                          onConfigure={() => host.configureRun(project.id, workOnEntryPrompt(entries[0]!))}
                          prompt={workOnEntryPrompt(entries[0]!)}
                          configureDescription="Opens the launcher with the top entry's prompt — one agent, not the batch."
                          className="text-muted-foreground hover:text-foreground"
                        />
                      </>
                    )}
                  </div>
                  {read.error !== undefined && (
                    <p role="alert" className="mt-1 text-xs text-danger">
                      Could not read the queue of {project.name}: {read.error}
                    </p>
                  )}
                  <ul className="mt-1.5 space-y-1 pl-0.5">
                    {entries.map((entry, i) => {
                      // A queued link reads as its text; the whole line stays in the tooltip.
                      const label = entryLabel(entry)
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span aria-hidden className="text-muted-foreground/50">•</span>
                          {label.url !== undefined ? (
                            <a href={label.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-foreground hover:underline" title={entry}>
                              {label.text}
                            </a>
                          ) : (
                            <span className="min-w-0 flex-1 truncate" title={entry}>
                              {label.text}
                            </span>
                          )}
                          <StartAgentButton
                            variant="ghost"
                            size="icon-sm"
                            icon={<Play className="h-3.5 w-3.5" aria-hidden />}
                            ariaLabel="Spin up an agent working on this entry"
                            menuAriaLabel={`Other ways to run ${label.text}`}
                            tooltip="Spin up an agent working on this entry"
                            busy={inFlight}
                            starting={starting === `${project.id}\n${entry}`}
                            onStart={() => void startEntry(project.id, entry)}
                            onConfigure={() => host.configureRun(project.id, workOnEntryPrompt(entry))}
                            prompt={workOnEntryPrompt(entry)}
                            configureDescription="Opens the launcher with this entry's prompt, so you can set the model and where it runs."
                            className="text-muted-foreground hover:text-foreground"
                          />
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
