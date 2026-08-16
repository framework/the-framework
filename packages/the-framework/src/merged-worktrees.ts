import { listProjectWorktrees, removeProjectWorktree, type RemoveResult, type WorktreeRow } from './worktrees.js'
import { withAgentLock } from './agent-locks.js'
import { worktreePath } from './store/index.js'

// Reclaim a session's checkout once its work is on the remote (#1036/E5).
//
// A worktree used to be kept or reclaimed by what state its run ended in: a clean finish removed
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
  /** The run id, which is also the worktree's directory name. */
  agentId: string
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
  /** Run ids whose checkouts the daemon is still responsible for; see {@link MergedSweepOptions.busy}. */
  busy?: ReadonlySet<string>
}

/**
 * Reclaim every retained worktree in `cwd` whose work can reach the remote (E5).
 *
 * The decision is entirely {@link removeProjectWorktree}'s — commit what is pending, push the
 * branch, remove only once the remote has it — so the automatic path and the manual one (the
 * dashboard's Remove button) are one behaviour rather than two that can disagree. This adds the
 * loop, the one thing it must never touch (a live run's checkout, where its agent is working), and
 * the run lock.
 *
 * The lock is load-bearing: a run's meta flips to `done` a beat before its teardown finishes
 * archiving, so a sweep landing in that window would remove the checkout out from under the
 * archive — which then recreates the directory it was reading from, and the removal silently
 * un-happens. Every other actor on a checkout already takes this lock.
 */
export async function removeMergedWorktrees(cwd: string, deps: MergedSweepDeps = {}): Promise<MergedSweepResult> {
  // Sizes off: `du` over every retained checkout is the expensive part of the listing, and a sweep
  // that only decides removal never reads the number.
  const worktrees = deps.worktrees ?? ((path: string) => listProjectWorktrees(path, { sizes: false }))
  const remove = deps.remove ?? removeProjectWorktree

  const result: MergedSweepResult = { removed: [], failed: [] }
  for (const row of await worktrees(cwd).catch((): WorktreeRow[] => [])) {
    if (row.live || deps.busy?.has(row.agentId)) continue
    const outcome = await withAgentLock(worktreePath(cwd, row.agentId), () => remove(cwd, row.agentId))
    if (outcome.ok) result.removed.push({ agentId: row.agentId })
    else result.failed.push({ agentId: row.agentId, error: outcome.error })
  }
  return result
}

/** A running sweep, in the shape the daemon's other background services use. */
export interface MergedWorktreeSweep {
  /** Run one sweep now, awaiting it. Exposed for tests and for a caller that wants it on demand. */
  tick: () => Promise<void>
  stop: () => void
}

/** What {@link startMergedWorktreeSweep} needs from the daemon. */
export interface MergedSweepOptions {
  /** The registered projects to sweep. */
  projects: () => Promise<readonly { path: string }[]>
  log: (message: string) => void
  /**
   * The runs the daemon is still responsible for — spawning, running, or mid-retirement — whose
   * checkouts this must not touch.
   *
   * "Not live" on disk is not "the daemon is finished with it": a run's meta flips to `done` a
   * beat before its teardown archives the history and reclaims the checkout, and a sweep landing
   * in that window races the teardown for the same directory. Absent means nothing is busy, which
   * is right for a caller that spawns no runs.
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
export function startMergedWorktreeSweep(opts: MergedSweepOptions): MergedWorktreeSweep {
  const sweep = opts.sweep ?? ((cwd: string) => removeMergedWorktrees(cwd, { ...(opts.busy ? { busy: opts.busy() } : {}) }))
  let stopped = false

  const sweepAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      const { removed, failed } = await sweep(project.path).catch((): MergedSweepResult => ({ removed: [], failed: [] }))
      for (const item of removed) {
        opts.log(
          `[framework] removed the worktree for session ${item.agentId}: its branch is on the remote. The branch and the session are kept.`,
        )
      }
      for (const item of failed) {
        opts.log(`[framework] kept the worktree for session ${item.agentId}: ${item.error}`)
      }
    }
  }

  // Overlapping ticks join the sweep already running rather than being dropped: awaiting `tick()`
  // has to mean the sweep finished, or an on-demand caller (and a test) gets a silent no-op
  // whenever the clock's turn happens to be mid-flight.
  let inflight: Promise<void> | undefined
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= sweepAll().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  // No timer of its own (E4): the daemon's one clock calls `tick`, including once at start-up —
  // the case this exists for is a machine that was off while the work could not be pushed.
  return {
    tick,
    stop: () => {
      stopped = true
    },
  }
}
