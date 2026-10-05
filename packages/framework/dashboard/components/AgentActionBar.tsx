import type { AgentWorktree, FrameworkEvent } from '../../src/index.js'
import { GitStatusBar } from './GitStatusBar.js'
import { AgentActionsMenu } from './AgentActionsMenu.js'
import { AgentErrorCount } from './AgentErrorCount.js'

// One agent's top bar: its name (a disclosure for the detail under the bar) on the left, and what
// you can DO to it on the right, a single ⋮ overflow menu (AgentActionsMenu). It says nothing of
// the agent's state or of its tree: the feed and the message box say whether the agent works and
// how it ended, and its branch, what the branch holds and the next step are in the bar above the
// message box (AgentWorkBar). One bar for the session whether running or finished (AgentView), so
// the controls stay put when an agent reaches Done.
export function AgentActionBar({
  projectId,
  agentId: agentId,
  events,
  retainedWorktree = false,
  onWorktreeRemoved,
  onDeleted,
  label,
  projectName,
  expanded = false,
  onToggle,
  ready = true,
  checkout,
}: {
  projectId: string
  /** Which run Stop addresses (#749). */
  agentId?: string | null | undefined
  events: FrameworkEvent[]
  /** The session's name — leads the bar, so the branch is git context, not the identity (#1030). */
  label?: string | undefined
  /** The session's project, shown as a `project / session` breadcrumb before the name. */
  projectName?: string | null | undefined
  /** True when this finished agent still has a worktree on disk, so it can be removed (#737). */
  retainedWorktree?: boolean
  /** Told after that worktree is removed, so the menu item goes. */
  onWorktreeRemoved?: () => void
  /** Told after this session is deleted, so the caller can leave it (#1032). Given only for a
   * finished run: absent, no delete is offered. */
  onDeleted?: (() => void) | undefined
  expanded?: boolean
  /** Given, the name reads as a disclosure for the detail the caller renders under this bar. */
  onToggle?: (() => void) | undefined
  /**
   * Whether this run's own reads have answered. Until they have, the bar names the run and shows
   * none of its facts: shown one by one as each read landed, the bar filled in over several steps,
   * and a fact still on screen from the run before read as this one's.
   */
  ready?: boolean
  /** The agent's checkout as the page read it (`null`: not answered yet), read once for this bar and the one above the message box. */
  checkout: AgentWorktree | null
}) {
  return (
    // One row, always (#1026). The name gives up width as the row fills; the controls never drop
    // under it, because a bar that reflows moves everything below it.
    <div className="@container flex items-center gap-2 overflow-hidden px-4 py-2">
      {/* Which session this is (#798/#809): its project, its name, and its worktree's size on disk. */}
      <GitStatusBar
        projectId={projectId}
        agentId={agentId}
        inline
        label={label}
        projectName={projectName}
        ready={ready}
        checkout={checkout}
        expanded={expanded}
        onToggle={onToggle}
      />
      {/* What the session IS sits at the start; what you can DO to it sits at the end. The spacer
          grows but never shrinks (#1030), so a tight row takes its width from the label. */}
      <div className="grow shrink-0" />
      <div className="flex shrink-0 items-center gap-2">
        {/* What the agent could not get past (#1500): the log scrolls, this row does not. It sits
            with the controls rather than beside the name, which gives up width as the row
            fills — a count is only useful if it is whole. */}
        {ready && <AgentErrorCount events={events} />}
        <AgentActionsMenu
          projectId={projectId}
          agentId={agentId}
          events={events}
          label={label}
          retainedWorktree={retainedWorktree}
          onWorktreeRemoved={onWorktreeRemoved}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  )
}
