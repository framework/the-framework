import type { AgentMeta } from '../../dist/index.js'
import { onRuns } from '../rpc/reads.js'
import { usePolled } from './use-async.js'

// The selected project's agents (live + archived), polled. Owned by the shell (+Page) so both
// the Runs rail and the main pane read one list: the rail renders the rows, the pane routes
// the selected run to its live view or replay by that run's status.
export function useRuns(projectId: string | null): { agents: AgentMeta[]; reload: () => void; loaded: boolean } {
  // `reload` is the shared guarded one now: it used to be a second, unguarded copy of the
  // read, so a run started just before a project switch could write the old project's agents.
  const { value: agents, reload, loaded } = usePolled<AgentMeta[]>(
    projectId ? () => onRuns(projectId) : null,
    [],
    2000,
    [projectId],
  )
  // `loaded` is what lets the shell tell a session that is gone from one it has not read yet
  // (#784): a bookmarked link must not flash "gone" while the first read is still out.
  return { agents: agents, reload, loaded }
}
