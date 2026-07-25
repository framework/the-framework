import { useState } from 'react'
import type { AutoPmJob, ProjectSummary } from '@gemstack/the-framework'
import { AUTO_PM_ROUTINES, runOptionsFromPreferences } from '@gemstack/the-framework/client'
import { CalendarClock, Play } from 'lucide-react'
import { onProjects } from '../server/projects.telefunc.js'
import { useAutoPm } from '../lib/quota.js'
import { usePreferences, updatePreferences } from '../lib/preferences.js'
import { useStartRun } from '../lib/use-start-run.js'
import { useLoaded } from '../lib/use-async.js'
import { formatUntil } from '../lib/format-date.js'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.js'
import { Button } from './ui/button.js'
import { Checkbox } from './ui/checkbox.js'

// The Overview's "Routine work" card (#1159): the jobs the idle sweep fires on a schedule, each with
// a Run now button that starts it against a project immediately.
//
// The list is `AUTO_PM_ROUTINES` itself, straight off the browser-safe client entry, so what is on
// screen is what the daemon runs rather than a second copy of it: no read of its own, and no way
// for the two to drift. Run now takes the same path the launcher does (`sendStart` with the job's
// prompt verbatim), so it starts the work now instead of asking the sweep to come round sooner.
//
// One auto-run checkbox for the whole card, not one per row: there is a single `autoPm` preference
// (#685), and a per-row box that flipped a global switch would be a lie about what it controls.

/** Captured once: `useLoaded` treats a fresh `[]` literal as a new value on every render. */
const NO_PROJECTS: ProjectSummary[] = []

export function RoutineWork({ onSelectProject }: { onSelectProject: (id: string) => void }) {
  const projects = useLoaded<ProjectSummary[]>(onProjects, NO_PROJECTS, [])
  const preferences = usePreferences()
  const report = useAutoPm()
  const { busy, error, start } = useStartRun()
  const [picked, setPicked] = useState<string | null>(null)
  // Which routine is in flight, so only its own button says "Starting…".
  const [starting, setStarting] = useState<string | null>(null)

  // The list arrives after the first render, and a project can be removed under a stale pick, so
  // the selection is validated against what is actually there rather than trusted.
  const projectId = (picked !== null && projects.some(p => p.id === picked) ? picked : projects[0]?.id) ?? null

  const autoRun = preferences.autoPm ?? false
  // The countdown is the sweep's, and the sweep only reports once the daemon has run one. With
  // auto-run off, or before that first report, the box says what it does instead of when.
  const autoRunLabel =
    autoRun && report?.nextSweepAt !== undefined ? `Auto-runs ${formatUntil(report.nextSweepAt)}` : 'Auto-run'

  const runNow = async (job: AutoPmJob) => {
    if (!projectId || busy) return
    setStarting(job.name)
    // The global options only: the Overview has no project open, so the per-project tier (#840) is
    // not resolved here and the run starts on the same defaults a fresh launcher would use.
    const result = await start(projectId, job.prompt, 'prompt', runOptionsFromPreferences(preferences))
    setStarting(null)
    // Jump into the project that is now working: the Overview has no view of a live run, and the
    // point of the button is to watch what it started.
    if (result) onSelectProject(projectId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Routine work
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Add a project to run a routine.</p>
        ) : (
          <>
            {projects.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="routine-project" className="text-muted-foreground">
                  Run in
                </label>
                <select
                  id="routine-project"
                  className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
                  value={projectId ?? ''}
                  onChange={e => setPicked(e.target.value)}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ul className="divide-y divide-border">
              {AUTO_PM_ROUTINES.map(job => (
                <li key={job.name} className="flex items-center gap-3 py-2 first:pt-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{job.label ?? job.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{job.describe}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={busy || !projectId}
                    onClick={() => void runNow(job)}
                  >
                    <Play className="h-3 w-3" aria-hidden />
                    {starting === job.name ? 'Starting…' : 'Run now'}
                  </Button>
                </li>
              ))}
            </ul>

            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}

            {/* The same `autoPm` preference the usage panel offers (#1161), which is the point: one
                switch, shown where the schedule it governs is listed. */}
            <div className="border-t border-border pt-3">
              <label
                className="flex cursor-pointer items-center gap-1.5 text-sm"
                title="Automatically run this prompt on a regular schedule."
              >
                <Checkbox checked={autoRun} onCheckedChange={checked => updatePreferences({ autoPm: checked })} />
                <span className="font-medium text-foreground">{autoRunLabel}</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Only while nothing else is running and the week&apos;s allowance is not already spent.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
