import type { ReactNode } from 'react'
import type { GitStatus, AgentWorktree } from '../../src/index.js'
import { ChevronRight, GitBranch } from 'lucide-react'
import { useCheckoutStatus } from '../lib/use-checkout-status.js'
import { formatBytes } from '../../src/client.js'
import { cn } from '../lib/utils.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// The checkout in play (#491, part of #488): active branch, a clean/dirty dot, the linked PR.
// Polled, so it tracks an agent committing or branching. Hidden when there is no git repo.
//
// One component for both pages (#809). With a `agentId` it reads that session's own worktree, which
// also carries its size on disk and the path it lives at; without one it reads the project's
// checkout. A session used to have its own differently-styled chip, so the same facts wore two
// looks depending on the page, and either could drift with an edit to the other.
//
// `inline` renders just the status (for an action bar); otherwise a full-width row.
//
// With a `label` (an agent's page) the row is the agent's name, its tree's clean/dirty and its
// state: its branch, what the branch holds and its pull request are said in the bar above the
// message box (`AgentWorkBar.tsx`), beside the next step. `onToggle` makes the name a disclosure
// for the detail the caller renders below.
export function GitStatusBar({
  projectId,
  agentId: agentId,
  inline = false,
  label,
  projectName,
  agentState,
  expanded = false,
  onToggle,
  ready = true,
  checkout: given,
}: {
  projectId: string
  /** The session whose worktree to report; absent reports the project's checkout. */
  agentId?: string | null | undefined
  inline?: boolean
  /** The session's name (#1030). Given, it leads as the bold identity and the branch drops to
   * muted git context beside it; absent (the project home), the branch stays the identity. */
  label?: string | undefined
  /** The project the session belongs to. Given alongside a label, it prefixes the name as a
   * `project / session` breadcrumb; it gives up width first, so the session name truncates last. */
  projectName?: string | null | undefined
  /** What state the agent itself is in (stopped, ready for merge, …), said beside the tree's own
   *  clean/dirty rather than at the far end of the bar: they are one line of facts about the
   *  session, where the bar's end is where its controls live. */
  agentState?: ReactNode
  expanded?: boolean
  /** Given, the branch reads as a disclosure for the detail the caller renders below. */
  onToggle?: (() => void) | undefined
  /** False while the caller's own facts are still being read: the label shows alone until then. */
  ready?: boolean
  /** The checkout as the caller already read it (`null`: not answered yet). Given, this bar reads nothing itself. */
  checkout?: GitStatus | AgentWorktree | null | undefined
}) {
  // Two reads: both carry the branch and its PR; the project's also its clean/dirty, the session's
  // its checkout (path, clean/dirty, size) while it still has one. A caller that reads it for more
  // than this bar hands its answer in (`checkout`), and nothing is read here.
  const read = useCheckoutStatus(projectId, agentId, given === undefined)
  const status = given === undefined ? read : given

  // The session's name, with its project as a breadcrumb: shown from the first frame, alone until
  // the facts beside it are there to show.
  const title = label && (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {/* The project, as a breadcrumb parent: muted, and always there. It keeps its width and is
          capped, so a long project name is cut at the cap and a long session name gives up the
          rest. Letting it give up width first squeezed it, separator and all, to nothing beside a
          long session name. The separator is `›`, not `/`: a run started by a command is named
          by it (`/update-tickets`), and `gemstack / /update-tickets` read as a doubled slash. */}
      {projectName && (
        <span data-testid="project-crumb" className="flex max-w-32 shrink-0 items-center gap-1.5 text-muted-foreground">
          <span className="min-w-0 truncate" title={projectName}>
            {projectName}
          </span>
          <span className="shrink-0 text-muted-foreground/60" aria-hidden>
            ›
          </span>
        </span>
      )}
      <span className="min-w-0 truncate font-medium text-foreground" title={label}>
        {label}
      </span>
    </span>
  )

  // The disclosure's chevron, where there is something to open. Drawn in the same place whether
  // or not the facts are in yet (dimmed until they are), so the name beside it never moves: it used
  // to appear with the facts and push the whole line over.
  const chevron = (enabled: boolean) =>
    onToggle && (
      <ChevronRight
        data-testid="disclosure-chevron"
        className={cn(
          'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
          expanded && 'rotate-90',
          !enabled && 'opacity-40',
        )}
      />
    )

  if (!status || !ready) {
    if (!title) return null
    // Laid out as the disclosure below is (chevron, then name, same gap), so the facts landing
    // beside the name is the only change.
    const alone = (
      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
        {chevron(false)}
        {title}
      </span>
    )
    return inline ? (
      <span className="flex min-w-0 items-center gap-2 overflow-hidden text-xs">{alone}</span>
    ) : (
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">{alone}</div>
    )
  }

  // A session's facts are its own checkout's while it has one; once that is gone, only its
  // recorded branch and PR, and no tree to be clean or dirty.
  const checkout = agentId ? (status as AgentWorktree).checkout : undefined
  const dirty = agentId ? checkout?.dirty : (status as GitStatus).dirty
  const branch = status.branch
  const size = formatBytes(checkout?.sizeBytes, '')
  // A session's checkout is the agent's tree, so uncommitted work there is the agent's; on the
  // project's own checkout it is the user's. Same dot, honest wording.
  const dirtyLabel = agentId ? 'Uncommitted changes in this agent' : 'Uncommitted changes'


  // One flat row so exactly one element gives up width: the label (or, with no label, the branch).
  // Everything else is shrink-0 and drops out at a container width instead of squeezing to mush.
  const facts = (
    <>
      {/* The chevron only appears where there is something to open, so a bar without a
          disclosure doesn't advertise one. */}
      {chevron(true)}
      {/* The session's name leads (#1030): it is what the rail calls this run and it does not
          change under you, unlike the branch, which the agent renames near the end (#736). It is
          the one element that shrinks, so it truncates last and the identity never disappears. */}
      {title}
      {/* The branch is the identity on the project home. An agent's branch is said in the bar above
          the message box, never here: not even for the moment its name is not known yet. */}
      {!label && !agentId && (
        <span className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          <Tooltip>
            <TooltipTrigger render={<span className="max-w-[16rem] truncate font-medium text-foreground" />}>{branch ?? 'no branch'}</TooltipTrigger>
            <TooltipContent>{`branch ${branch}`}</TooltipContent>
          </Tooltip>
        </span>
      )}
      {agentState}
      {/* Clean is neutral, not green. Green means "added / new / done" everywhere else, so a
          green dot for "nothing changed" sat one pane away from the file tree's green dot for
          "this folder HAS changes": the same colour for opposite facts. A clean tree is the
          unremarkable default and has nothing to announce. */}
      {/* A session whose checkout is gone has no tree to be either. */}
      {dirty !== undefined && (
        <Tooltip>
          <TooltipTrigger render={<span className="flex shrink-0 items-center gap-1.5" />}>
            <span className={cn('h-2 w-2 rounded-full', dirty ? 'bg-warning' : 'bg-muted-foreground')} />
            <span className="text-muted-foreground">{dirty ? 'dirty' : 'clean'}</span>
          </TooltipTrigger>
          <TooltipContent>{dirty ? dirtyLabel : 'Clean'}</TooltipContent>
        </Tooltip>
      )}
      {/* Only a worktree has a size worth showing, and only once nothing is writing to it (#798). */}
      {size && (
        <Tooltip>
          <TooltipTrigger render={<span className="hidden shrink-0 text-muted-foreground @4xl:inline" />}>
            {size}
          </TooltipTrigger>
          <TooltipContent>This agent&apos;s worktree on disk</TooltipContent>
        </Tooltip>
      )}
    </>
  )

  const content = (
    <>
      {/* A disclosure wraps only the facts: the PR link and the copy button are interactive in
          their own right and can't sit inside a button. */}
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 items-center gap-2 overflow-hidden rounded text-left hover:text-foreground"
        >
          {facts}
        </button>
      ) : (
        facts
      )}
      {!label && !agentId && status.pr && (
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                href={status.pr.url}
                target="_blank"
                rel="noreferrer"
                className={cn('flex shrink-0 items-center gap-1.5 text-primary hover:underline', !inline && 'ml-auto')}
              />
            }
          >
            <span>PR #{status.pr.number}</span>
            <span className="rounded-full border border-border px-1.5 text-[10px] uppercase text-muted-foreground">
              {status.pr.state.toLowerCase()}
            </span>
          </TooltipTrigger>
          <TooltipContent>{status.pr.title}</TooltipContent>
        </Tooltip>
      )}
    </>
  )

  // `overflow-hidden`: on a pane too narrow for even the branch, it is cut off rather than
  // painted over the buttons beside it (#1026).
  if (inline) return <span className="flex min-w-0 items-center gap-2 overflow-hidden text-xs">{content}</span>

  return <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">{content}</div>
}
