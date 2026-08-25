import { listProjectWorktrees, removeProjectWorktree, type RemoveResult, type WorktreeRow } from './worktrees.js'
import { withAgentLock } from './agent-locks.js'
import { repoHasRemote, worktreePath } from './store/index.js'
import { startProjectPass, type ProjectPass, type ProjectsSource } from './project-pass.js'

// Reclaim a session's checkout once its work is on the remote (#1036/E5).
//
// A worktree used to be kept or reclaimed by what state its agent ended in: a clean finish removed
// it, a failure or stop kept it "so you can look at what it was holding" (#752), and a merged
// branch reclaimed it later — through two different "landed" signals, because a squash merge
// rewrites the commits and the local ancestor check never fires. Nothing removed the rest on a
// timer, so a machine accumulated one full checkout per failed session forever.
//
// One rule replaces all of it: **only what is on the remote may go**. Every deletion is
// recoverable, because the remote holds a copy, and the question stops being *how did this end*
// and becomes *is it pushed yet* — one predicate, checkable at any moment, with one failure mode.
//
// The sweep is what makes that rule reach the sessions it could not reach at teardown: a push that
// failed then (offline, no auth, a rejected non-fast-forward) simply succeeds on a later pass. It
// removes the *checkout*, never the history: the branch stays, the session's row and replayable log
// stay, and everything it deletes is reconstructable with `git worktree add`.

/** One worktree this sweep removed. */
export interface RemovedWorktree {
  /** The agent id, which is also the worktree's directory name. */
  agentId: string
  /** Branches that went with it: one holding nothing the remote lacks (#1650), a run-id branch the kept branch contains (#1657). */
  branchesDeleted?: string[]
}

/** A worktree the sweep tried to reclaim and could not, and why. */
export interface FailedRemoval {
  agentId: string
  error: string
}

/** What {@link removeMergedWorktrees} did. */
export interface MergedSweepResult {
  removed: RemovedWorktree[]
  /** Worktrees it tried and could not reclaim — most often a branch it could not push. */
  failed: FailedRemoval[]
}

/** Injectable seams so the sweep is unit-testable off disk. */
export interface MergedSweepDeps {
  /** The worktrees on disk (default {@link listProjectWorktrees}). */
  worktrees?: (cwd: string) => Promise<WorktreeRow[]>
  /** Removes one worktree (default {@link removeProjectWorktree}). */
  remove?: (cwd: string, agentId: string) => Promise<RemoveResult>
  /** Whether the repo has a remote at all (default {@link repoHasRemote}). */
  hasRemote?: (cwd: string) => Promise<boolean>
  /** Agent ids whose checkouts the daemon is still responsible for; see {@link MergedSweepOptions.busy}. */
  busy?: ReadonlySet<string>
}

/**
 * Reclaim every retained worktree in `cwd` whose work can reach the remote (E5).
 *
 * The decision is entirely {@link removeProjectWorktree}'s — commit what is pending, push the
 * branch, remove only once the remote has it — so the automatic path and the manual one (the
 * dashboard's Remove button) are one behaviour rather than two that can disagree. This adds the
 * loop, the one thing it must never touch (a live agent's checkout, where its agent is working), and
 * the agent lock.
 *
 * The lock is load-bearing: an agent's meta flips to `done` a beat before its teardown finishes
 * archiving, so a sweep landing in that window would remove the checkout out from under the
 * archive — which then recreates the directory it was reading from, and the removal silently
 * un-happens. Every other actor on a checkout already takes this lock.
 */
export async function removeMergedWorktrees(cwd: string, deps: MergedSweepDeps = {}): Promise<MergedSweepResult> {
  // Sizes off: `du` over every retained checkout is the expensive part of the listing, and a sweep
  // that only decides removal never reads the number.
  const worktrees = deps.worktrees ?? ((path: string) => listProjectWorktrees(path, { sizes: false }))
  const remove = deps.remove ?? removeProjectWorktree
  const hasRemote = deps.hasRemote ?? repoHasRemote

  const result: MergedSweepResult = { removed: [], failed: [] }
  const rows = (await worktrees(cwd).catch((): WorktreeRow[] => [])).filter(
    row => !row.live && !deps.busy?.has(row.agentId),
  )
  if (!rows.length) return result
  // Asked once per project, not once per checkout: with no remote the rule keeps everything, and
  // that answer cannot change between two rows of the same sweep — so the doomed per-checkout
  // probe-and-push cycle is skipped while each retained checkout is still accounted for.
  if (!(await hasRemote(cwd))) {
    for (const row of rows) result.failed.push({ agentId: row.agentId, error: 'the repo has no remote; its worktree was kept' })
    return result
  }
  for (const row of rows) {
    const outcome = await withAgentLock(worktreePath(cwd, row.agentId), () => remove(cwd, row.agentId))
    if (outcome.ok) result.removed.push({ agentId: row.agentId, ...(outcome.branchesDeleted ? { branchesDeleted: outcome.branchesDeleted } : {}) })
    else result.failed.push({ agentId: row.agentId, error: outcome.error })
  }
  return result
}

/** `its branch x` / `its branches x and y`, for the removal line. */
export function describeDeleted(branches: readonly string[]): string {
  return branches.length === 1 ? `its branch ${branches[0]}` : `its branches ${branches.join(' and ')}`
}

/** What {@link startMergedWorktreeSweep} needs from the daemon. */
export interface MergedSweepOptions {
  /** The registered projects to sweep. */
  projects: ProjectsSource
  log: (message: string) => void
  /**
   * The agents the daemon is still responsible for — spawning, running, or mid-retirement — whose
   * checkouts this must not touch.
   *
   * "Not live" on disk is not "the daemon is finished with it": an agent's meta flips to `done` a
   * beat before its teardown archives the history and reclaims the checkout, and a sweep landing
   * in that window races the teardown for the same directory. Absent means nothing is busy, which
   * is right for a caller that spawns no agents.
   */
  busy?: () => ReadonlySet<string>
  /** The per-project sweep (default {@link removeMergedWorktrees}). */
  sweep?: (cwd: string) => Promise<MergedSweepResult>
}

/**
 * Sweep every registered project's reclaimable worktrees (#1036), one turn per call.
 *
 * Says what it removed rather than removing it silently: a checkout vanishing from under someone
 * with no line explaining why reads as a bug, even when the work behind it is safe.
 */
export function startMergedWorktreeSweep(opts: MergedSweepOptions): ProjectPass {
  const sweep = opts.sweep ?? ((cwd: string) => removeMergedWorktrees(cwd, { ...(opts.busy ? { busy: opts.busy() } : {}) }))
  // Each checkout's last-announced keep reason, so a retained checkout is accounted for once per
  // *state* rather than re-announced every ten minutes for the life of the daemon — a permanently
  // unpushable one (no remote, a publish-nothing session) repeats forever. A changed reason is a
  // changed state and is said again (a remote added, pushes now failing on auth); a removal
  // clears the entry, so a same-id checkout that reappears is a new thing to account for; a
  // daemon restart starts the accounting over, which is the boot-time announcement the retained
  // state deserves.
  const announced = new Map<string, string>()

  // No timer of its own (E4): the daemon's one clock calls `tick`, including once at start-up —
  // the case this exists for is a machine that was off while the work could not be pushed.
  return startProjectPass(opts.projects, async cwd => {
    const { removed, failed } = await sweep(cwd).catch((): MergedSweepResult => ({ removed: [], failed: [] }))
    for (const item of removed) {
      announced.delete(item.agentId)
      opts.log(
        item.branchesDeleted
          ? `[framework] removed the worktree for session ${item.agentId} and ${describeDeleted(item.branchesDeleted)}: nothing on it is missing elsewhere. The session is kept.`
          : `[framework] removed the worktree for session ${item.agentId}: its branch is on the remote. The branch and the session are kept.`,
      )
    }
    for (const item of failed) {
      if (announced.get(item.agentId) === item.error) continue
      announced.set(item.agentId, item.error)
      opts.log(`[framework] kept the worktree for session ${item.agentId}: ${item.error}`)
    }
  })
}
