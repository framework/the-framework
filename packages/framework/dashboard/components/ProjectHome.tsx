import type { FrameworkEvent, ProjectError } from '../../src/index.js'
import { StartAgentForm } from './StartAgentForm.js'
import { ProjectActions } from './ProjectActions.js'
import { ProjectErrorBanner } from './ProjectErrorBanner.js'
import { AgentOverview } from './AgentOverview.js'
import { OpenQuestions } from './OpenQuestions.js'
import { ScrollArea } from './ui/scroll-area.js'

// The project home / launcher — what "Live" selects. Always the Start form + the current stack
// overview; it is never consumed by an agent. Starting one appends an agent to
// the rail and adds that agent's own view (AgentView) alongside — this page stays put, so you can
// launch again. (Actually running several at once lands with git worktrees, #453.)
//
// Below the form, the sections (#1455): every session's open questions in one answerable
// place (item 4 + bonuses 1/2 — the launcher's main event now that tickets are gone). The
// project's Docs are not here: they are the side panel's "Docs" tab (RightRail), on this page
// as on an agent's. The tickets section
// (item 5) was REMOVED on the maintainer's call: the /tickets page is the one clear path
// to the backlog, and 67 open tickets pushed everything else below the fold. All the
// sections can be tall, which is why the whole column scrolls.
export function ProjectHome({
  projectId,
  projectName,
  scope = null,
  events,
  onAgentStarted,
  files,
  context,
  addContext,
  removeContext,
  toggleContext,
  onOpenAgent,
  errors,
}: {
  projectId: string
  /** The project's name, for the bar at the top and the launcher's chip; absent until the projects are read. */
  projectName?: string | null | undefined
  /** The project picked in the sidebar (#1513), or null for all: the open questions shown are its only. */
  scope?: string | null
  events: FrameworkEvent[]
  /** Carries the started agent's id through to the shell; dropping it is what #1169 was. */
  onAgentStarted?: ((intent: string, agentId: string, runsOn?: string) => void) | undefined
  files: string[]
  /** The Context set and its edits, owned by the shell and shared with the file tree (#492). */
  context: Set<string>
  addContext: (path: string) => void
  removeContext: (path: string) => void
  toggleContext: (path: string) => void
  /** Jump into a parked session (#1455 item 4) — possibly another project's. */
  onOpenAgent: (projectId: string, agentId: string) => void
  /** What the daemon currently finds wrong with the project (#1500), off the shell's project list. */
  errors?: ProjectError[] | undefined
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ProjectActions projectId={projectId} projectName={projectName} />
      {/* Above the start form, because an agent started on a project whose agent-data branch cannot
          reach origin (#1599) works from stale tickets and a queue nobody else will see. */}
      <ProjectErrorBanner errors={errors} />
      <StartAgentForm
        projectId={projectId}
        projectName={projectName}
        onAgentStarted={onAgentStarted}
        files={files}
        context={context}
        addContext={addContext}
        removeContext={removeContext}
        toggleContext={toggleContext}
      />
      {events.length > 0 && <AgentOverview events={events} />}
      <OpenQuestions projectId={scope} onOpenAgent={onOpenAgent} />
    </ScrollArea>
  )
}
