import { listProjectWorktrees, removeProjectWorktree, type RemoveResult, type WorktreeRow } from './worktrees.js'

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
  runId: string
}

/** A worktree the sweep tried to reclaim and could not, and why. */
export interface FailedRemoval {
  runId: string
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
  remove?: (cwd: string, runId: string) => Promise<RemoveResult>
}

/**
 * Reclaim every retained worktree in `cwd` whose work can reach the remote (E5).
 *
 * The decision is entirely {@link removeProjectWorktree}'s — commit what is pending, push the
 * branch, remove only once the remote has it — so the automatic path and the manual one (the
 * dashboard's Remove button) are one behaviour rather than two that can disagree. This adds only
 * the loop and the one thing it must never touch: a live run's checkout, which is where its agent
 * is working.
 */
export async function removeMergedWorktrees(cwd: string, deps: MergedSweepDeps = {}): Promise<MergedSweepResult> {
  // Sizes off: `du` over every retained checkout is the expensive part of the listing, and a sweep
  // that only decides removal never reads the number.
  const worktrees = deps.worktrees ?? ((path: string) => listProjectWorktrees(path, { sizes: false }))
  const remove = deps.remove ?? removeProjectWorktree

  const result: MergedSweepResult = { removed: [], failed: [] }
  for (const row of await worktrees(cwd).catch((): WorktreeRow[] => [])) {
    if (row.live) continue
    const outcome = await remove(cwd, row.runId)
    if (outcome.ok) result.removed.push({ runId: row.runId })
    else result.failed.push({ runId: row.runId, error: outcome.error })
  }
  return result
}

/**
 * How long between sweeps.
 *
 * Ten minutes, because this is about disk reclaimed over days rather than seconds: a session whose
 * push landed at teardown is already gone, and what is left here is the one whose push could not
 * land yet — a machine that was offline, or a remote that was not reachable.
 */
const DEFAULT_MERGED_SWEEP_INTERVAL_MS = 10 * 60 * 1000

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
  intervalMs?: number
  /** The per-project sweep (default {@link removeMergedWorktrees}). */
  sweep?: (cwd: string) => Promise<MergedSweepResult>
}

/**
 * Sweep every registered project's reclaimable worktrees on a timer (#1036).
 *
 * Says what it removed rather than removing it silently: a checkout vanishing from under someone
 * with no line explaining why reads as a bug, even when the work behind it is safe.
 *
 * Runs immediately on start and then every {@link DEFAULT_MERGED_SWEEP_INTERVAL_MS}; overlapping
 * ticks are dropped, and the timer is unref'd so a background sweep is never the reason the
 * process stays up.
 */
export function startMergedWorktreeSweep(opts: MergedSweepOptions): MergedWorktreeSweep {
  const sweep = opts.sweep ?? removeMergedWorktrees
  let stopped = false

  const sweepAll = async (): Promise<void> => {
    for (const project of await opts.projects().catch(() => [])) {
      if (stopped) break
      const { removed, failed } = await sweep(project.path).catch((): MergedSweepResult => ({ removed: [], failed: [] }))
      for (const item of removed) {
        opts.log(
          `[framework] removed the worktree for session ${item.runId}: its branch is on the remote. The branch and the session are kept.`,
        )
      }
      for (const item of failed) {
        opts.log(`[framework] kept the worktree for session ${item.runId}: ${item.error}`)
      }
    }
  }

  // Overlapping ticks join the sweep already running rather than being dropped: awaiting `tick()`
  // has to mean the sweep finished, or an on-demand caller (and a test) gets a silent no-op
  // whenever the timer or the start-up sweep happens to be mid-flight.
  let inflight: Promise<void> | undefined
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= sweepAll().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  // Swept once at start-up, not only after the first interval: the case this exists for is a
  // machine that was off (or a daemon that was down) while the work could not be pushed.
  void tick()
  const timer = setInterval(() => void tick(), opts.intervalMs ?? DEFAULT_MERGED_SWEEP_INTERVAL_MS)
  timer.unref?.()
  return {
    tick,
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}
