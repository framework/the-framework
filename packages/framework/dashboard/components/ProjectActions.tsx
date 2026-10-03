import type { FrameworkEvent } from '../../src/index.js'
import { AgentActionsMenu } from './AgentActionsMenu.js'
import { GitStatusBar } from './GitStatusBar.js'

/** The menu is given no session, so no events: it acts on the project. Stable, so it does not churn on every render. */
const NO_EVENTS: FrameworkEvent[] = []

// The project home's action bar (#488). Git status (#491) reads on the left, the ⋮ menu of actions
// on the right. Both halves are shared with a session's bar (#809), so the two pages cannot drift:
// this one passes no session, and so reports and acts on the project's own checkout.
//
// The project's name leads the bar (#1513): with all projects showing in the sidebar, nothing else
// on the launcher says which project the agent will start in.
export function ProjectActions({ projectId, projectName }: { projectId: string; projectName?: string | null | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {projectName && <span className="text-sm font-semibold">{projectName}</span>}
      <GitStatusBar projectId={projectId} inline />
      <div className="min-w-0 flex-1" />
      <AgentActionsMenu projectId={projectId} events={NO_EVENTS} />
    </div>
  )
}
