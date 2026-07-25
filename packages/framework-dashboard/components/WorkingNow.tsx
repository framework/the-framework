import type { ActiveRun } from '@gemstack/the-framework'
import { cn } from '../lib/utils.js'

// Every row here is one session, and it says so: a status dot, the project, the session name and
// what it was asked to build. It used to open that project's launcher, dropping the run id it was
// holding, so pressing "Building: my-app, add a login page" landed on an empty composer with no
// sign of the session just described. The row goes where it points.
export function WorkingNow({
  active,
  onSelectRun,
}: {
  active: ActiveRun[]
  onSelectRun: (id: string, runId: string) => void
}) {
  if (active.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Nothing running.</p>
  }
  return (
    <ul className="divide-y divide-border">
      {active.map(run => (
        // Keyed by project + run (#738): one project can have several runs in flight.
        <li key={`${run.projectId}:${run.runId}`}>
          <button
            type="button"
            onClick={() => onSelectRun(run.projectId, run.runId)}
            className="flex w-full flex-col items-start gap-0.5 py-2 text-left hover:opacity-80"
          >
            <span className="flex w-full items-center gap-1.5">
              {/* Decorative dot + sr-only status (#695/U33): color alone reaches no screen reader. */}
              <span
                aria-hidden
                className={cn('h-2 w-2 shrink-0 rounded-full', run.readyForMerge ? 'bg-success' : 'animate-pulse bg-warning')}
                title={run.readyForMerge ? 'Ready for merge' : 'Building'}
              />
              <span className="sr-only">{run.readyForMerge ? 'Ready for merge' : 'Building'}: </span>
              <span className="truncate font-medium">{run.projectName}</span>
              {run.sessionName && <span className="truncate text-xs text-muted-foreground">{run.sessionName}</span>}
            </span>
            {(run.intent || run.scope) && (
              <span className="truncate pl-3.5 text-xs text-muted-foreground">{run.intent || run.scope}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
