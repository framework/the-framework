import type { FrameworkEvent } from '@gemstack/the-framework'
import { StartRunForm } from './StartRunForm.js'
import { ProjectActions } from './ProjectActions.js'
import { RunOverview } from './RunOverview.js'
import { OpenQuestions } from './OpenQuestions.js'
import { ProjectDocs } from './ProjectDocs.js'
import { ProjectHistory } from './ProjectHistory.js'
import { ScrollArea } from './ui/scroll-area.js'

// The project home / launcher — what "Live" selects. Always the Start form + preset cards +
// the current stack overview; it is never consumed by a run. Starting one appends a run to
// the rail and adds that run's own view (RunView) alongside — this page stays put, so you can
// launch again. (Actually running several at once lands with git worktrees, #453.)
//
// Below the form, the #1455 sections: every session's open questions in one answerable
// place (item 4 + bonuses 1/2 — the launcher's main event now that tickets are gone), and
// the Docs + History panels moved out of the right rail into this column (items 2/3 — the
// rail hides them while this page shows, see RightRail's docsInMain). The tickets section
// (item 5) was REMOVED on the maintainer's call: the /tickets page is the one clear path
// to the backlog, and 67 open tickets pushed everything else below the fold. All the
// sections can be tall, which is why the whole column scrolls.
export function ProjectHome({
  projectId,
  events,
  onRunStarted,
  files,
  context,
  addContext,
  removeContext,
  toggleContext,
  onOpenSession,
}: {
  projectId: string
  events: FrameworkEvent[]
  /** Carries the started run's id through to the shell; dropping it is what #1169 was. */
  onRunStarted?: ((intent: string, runId?: string, runsOn?: string) => void) | undefined
  files: string[]
  context: Set<string>
  addContext: (path: string) => void
  removeContext: (path: string) => void
  toggleContext: (path: string) => void
  /** Jump into a parked session (#1455 item 4) — possibly another project's. */
  onOpenSession: (projectId: string, runId: string) => void
}) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ProjectActions projectId={projectId} />
      <StartRunForm
        projectId={projectId}
        onRunStarted={onRunStarted}
        files={files}
        context={context}
        addContext={addContext}
        removeContext={removeContext}
        toggleContext={toggleContext}
      />
      {events.length > 0 && <RunOverview events={events} />}
      <OpenQuestions onOpenSession={onOpenSession} />
      <ProjectDocs projectId={projectId} />
      <ProjectHistory projectId={projectId} />
    </ScrollArea>
  )
}
