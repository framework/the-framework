import type { AgentWorktree } from '../../src/index.js'
import { ChevronRight } from 'lucide-react'
import { formatBytes } from '../../src/client.js'
import { cn } from '../lib/utils.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'

// Which agent this is, at the start of the agent's top bar (AgentActionBar): the agent's name,
// its project as a breadcrumb before it, and the size on disk of its worktree.
//
// It says nothing of the agent's state or of its tree: whether it works and how it ended are
// said by the feed and the message box, and its branch, what the branch holds and its pull request
// in the bar above the message box (`AgentWorkBar.tsx`), beside the next step. `onToggle` makes
// the name a disclosure for the detail the caller renders below.
//
// It reads nothing itself: the agent's page reads the checkout once and hands it in.
export function GitStatusBar({
  label,
  projectName,
  expanded = false,
  onToggle,
  ready = true,
  checkout,
}: {
  /** The session's name (#1030): the bold identity of the line. */
  label?: string | undefined
  /** The project the session belongs to. Given alongside a label, it prefixes the name as a
   * `project / session` breadcrumb; it keeps its width up to a cap, so the session name truncates. */
  projectName?: string | null | undefined
  expanded?: boolean
  /** Given, the name reads as a disclosure for the detail the caller renders below. */
  onToggle?: (() => void) | undefined
  /** False while the caller's own facts are still being read: the label shows alone until then. */
  ready?: boolean
  /** The agent's checkout as the caller read it (`null`: not answered yet). */
  checkout: AgentWorktree | null
}) {
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

  // The line waits only for `ready`, not for the checkout's answer: a new agent's checkout is read
  // up to ten seconds after it starts, and the line is laid out the same with or without it.
  // Only once nothing is writing to the worktree is there a size to show (#798).
  const size = ready ? formatBytes(checkout?.checkout?.sizeBytes, '') : ''

  // One flat row so exactly one element gives up width: the label. The size is shrink-0 and drops
  // out at a container width instead of squeezing to mush.
  const facts = (
    <>
      {/* Drawn only where there is something to open, so a bar without a disclosure doesn't
          advertise one. */}
      {chevron(ready)}
      {/* The session's name leads (#1030): it is what the rail calls this run and it does not
          change under you, unlike the branch, which the agent renames near the end (#736). It is
          the one element that shrinks, so it truncates last and the identity never disappears. */}
      {title}
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

  // `overflow-hidden`: on a pane too narrow for even the name, it is cut off rather than painted
  // over the buttons beside it (#1026).
  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden text-xs">
      {/* Until the facts are in, the name is not a button: there is no detail to open yet. It is
          laid out as the disclosure is (chevron, then name, same gap), so the size landing beside
          the name is the only change. */}
      {onToggle && ready ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 items-center gap-2 overflow-hidden rounded text-left hover:text-foreground"
        >
          {facts}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">{facts}</span>
      )}
    </span>
  )
}
