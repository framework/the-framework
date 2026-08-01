import type { LogEntry } from '@gemstack/the-framework'
import { onProjectLog } from '../server/reads.telefunc.js'
import { usePolled } from '../lib/use-async.js'
import { ProjectLogPanel } from './ProjectLogPanel.js'

/** Stable initial for the poll, so it does not churn on every render. */
const EMPTY_LOGS: LogEntry[] = []

/**
 * The project's session history on the launcher (#1455 item 3): moved out of the right rail
 * into the main column, same ProjectLogPanel presentation (the committed `.the-framework/LOGS.md`,
 * newest first). A project with no finished sessions gets no section — the rail's
 * earned-by-content rule (#1146) applies here unchanged. Height-capped like the Docs section.
 */
export function ProjectHistory({ projectId }: { projectId: string }) {
  const { value: logs, loaded } = usePolled<LogEntry[]>(() => onProjectLog(projectId), EMPTY_LOGS, 10_000, [projectId])
  if (!loaded || logs.length === 0) return null
  return (
    <section aria-label="History" className="border-t border-border p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
      <div className="flex max-h-[24rem] flex-col overflow-hidden rounded-md border border-border">
        <ProjectLogPanel logs={logs} loaded />
      </div>
    </section>
  )
}
