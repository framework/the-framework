import type { FileContent } from '../../src/index.js'
import { onFileContent, onPlanAgent, type PlanAgent } from '../rpc/reads.js'
import { usePolled } from '../lib/use-async.js'
import { Markdown } from './Markdown.js'
import { TicketPageShell, TicketPageNote } from './TicketPageShell.js'
import { Button } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

/** Where tickets and their plans live, repo-relative. The literal, not the package's Node-bound
 *  `TICKETS_DIR` const, so nothing drags the server graph into the browser bundle. */
const TICKETS_DIR = 'tickets'

/**
 * A ticket's plan filename from its own slug: `<stem>.plan.md` beside the ticket. The stem is the
 * ticket's `.md` name without the extension, so `2026-07-20_do-the-thing.md` plans as
 * `2026-07-20_do-the-thing.plan.md`. Exported so its one caller and the test agree on the spelling.
 */
export function planPath(slug: string): string {
  return `${TICKETS_DIR}/${slug.replace(/\.md$/, '')}.plan.md`
}

// One ticket's plan (#685): its `<stem>.plan.md` rendered as markdown, the destination of the
// tickets list's plan-column link. A plan is a plain repo file, so this reads it through the same
// confined `onFileContent` the file-preview cards use rather than a bespoke endpoint — the read
// already guards traversal and caps the length. `slug` is the ticket's filename, the same the list
// row and the detail route carry, so the plan is addressed by the ticket it belongs to.
export function TicketPlanPage({
  projectId,
  slug,
  onBack,
  onOpenAgent,
}: {
  projectId: string
  /** The ticket's filename inside `tickets/`, same as `WorkspaceTicket.file`. */
  slug: string
  /** Back to the tickets list. */
  onBack: () => void
  /** Open an agent's session view (#1511): where the plan's author is resumed. */
  onOpenAgent: (agentId: string) => void
}) {
  const path = planPath(slug)
  const { value: plan, loaded } = usePolled<FileContent | null>(() => onFileContent(projectId, path), null, 10_000, [projectId, path])
  // The agent that wrote the plan (#1511), from the framework's records — the plan file carries no
  // marker. Its session view is where the conversation continues: the composer there already
  // resumes a finished agent in place, local or web, so this page only has to point at it.
  const { value: agent } = usePolled<PlanAgent | null>(() => onPlanAgent(projectId, slug), null, 10_000, [projectId, slug])

  return (
    <TicketPageShell onBack={onBack} path={path}>
      {!loaded ? (
        <TicketPageNote>Loading…</TicketPageNote>
      ) : !plan || plan.binary ? (
        // No `.plan.md` beside the ticket — never written, or removed since the list read.
        <TicketPageNote>This ticket has no plan yet.</TicketPageNote>
      ) : (
        <>
          {agent && <PlanAgentRow agent={agent} onOpen={() => onOpenAgent(agent.agentId)} />}
          <Markdown text={plan.text} />
          {/* The confined read caps long files; say so rather than pretending the tail is empty. */}
          {plan.truncated && <p className="mt-4 text-xs text-muted-foreground">Plan truncated — open the file to read the rest.</p>}
        </>
      )}
    </TicketPageShell>
  )
}

/**
 * Who wrote the plan and the way back to them (#1511). A finished agent is resumed — same session,
 * same branch, same conversation — so the plan can be discussed with the agent that has it in
 * context; one still running is simply opened.
 */
function PlanAgentRow({ agent, onOpen }: { agent: PlanAgent; onOpen: () => void }) {
  const running = agent.status === 'running'
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
      <span>{running ? 'An agent is writing this plan right now.' : 'Written by an agent whose session can be picked up where it left off.'}</span>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={onOpen} />}>
          {running ? 'Open agent' : 'Resume agent'}
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          {running
            ? 'Opens the session writing this plan, so you can watch it or step in.'
            : 'Opens the session of the agent that wrote this plan. Anything you send there continues that same conversation — the plan, the ticket and the reasoning behind it are already in its context.'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
