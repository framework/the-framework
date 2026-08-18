import type { FrameworkEvent } from '../../src/index.js'
import { StartAgentForm } from './StartAgentForm.js'
import { ProjectActions } from './ProjectActions.js'
import { AgentOverview } from './AgentOverview.js'
import { OpenQuestions } from './OpenQuestions.js'
import { ProjectDocs } from './ProjectDocs.js'
import { ScrollArea } from './ui/scroll-area.js'

// The project home / launcher — what "Live" selects. Always the Start form + preset cards +
// the current stack overview; it is never consumed by an agent. Starting one appends an agent to
// the rail and adds that agent's own view (AgentView) alongside — this page stays put, so you can
// launch again. (Actually running several at once lands with git worktrees, #453.)
//
// Below the form, the sections (#1455): every session's open questions in one answerable
// place (item 4 + bonuses 1/2 — the launcher's main event now that tickets are gone), and
// the Docs panel moved out of the right rail into this column (items 2/3 — the rail hides
// it while this page shows, see RightRail's docsInMain; the History panel that moved with
// it was removed outright with LOGS.md, #1536). The tickets section
// (item 5) was REMOVED on the maintainer's call: the /tickets page is the one clear path
// to the backlog, and 67 open tickets pushed everything else below the fold. All the
// sections can be tall, which is why the whole column scrolls.
export function ProjectHome({
  projectId,
  events,
  onAgentStarted,
  files,
  context,
  addContext,
  removeContext,
  toggleContext,
  onOpenAgent,
}: {
  projectId: string
  events: FrameworkEvent[]
  /** Carries the started agent's id through to the shell; dropping it is what #1169 was. */
  onAgentStarted?: ((intent: string, agentId?: string, runsOn?: string) => void) | undefined
  files: string[]
  context: Set<string>
  addContext: (path: string) => void
  removeContext: (path: string) => void
  toggleContext: (path: string) => void
  /** Jump into a parked session (#1455 item 4) — possibly another project's. */
  onOpenAgent: (projectId: string, agentId: string) => void
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ProjectActions projectId={projectId} />
      <StartAgentForm
        projectId={projectId}
        onAgentStarted={onAgentStarted}
        files={files}
        context={context}
        addContext={addContext}
        removeContext={removeContext}
        toggleContext={toggleContext}
      />
      {events.length > 0 && <AgentOverview events={events} />}
      <OpenQuestions onOpenAgent={onOpenAgent} />
      <ProjectDocs projectId={projectId} />
    </ScrollArea>
  )
}
