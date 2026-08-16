import { errorMessage } from './error-message.js'

/**
 * The daemon's one background clock (E4).
 *
 * Every sweep used to own a timer: the CI watch on a minute, the worktree sweep and auto PM on ten,
 * the session committer's debounce on thirty seconds, the two Discord watchers on a minute each.
 * Six intervals with six `setInterval`s, six unref calls and six overlap guards, and no single
 * place to look when the answer to "why is nothing happening" is that a sweep is not running.
 *
 * One interval fires, and each job says how often it wants a turn. A job's cadence stops being a
 * duration it has to reason about and becomes a small integer: how many ticks between turns.
 *
 * The base interval is the finest cadence anything needs. Anything slower is that many ticks —
 * exact by construction, because the ratios are integers rather than two timers drifting apart.
 */

/** One thing the daemon does on a schedule. */
export interface TickJob {
  /** For the log line when it throws. */
  name: string
  /**
   * Ticks between turns. `1` is every tick, `20` is every twentieth. Its own turn is *skipped*
   * rather than queued, so a slow job never accumulates a backlog of missed turns to work through.
   */
  every?: number
  /** Run one turn. Awaited, so a long job holds the tick rather than overlapping the next one. */
  run: () => Promise<void>
  /**
   * Run on the very first tick, which fires at start-up rather than one interval later.
   *
   * On by default, because the case most of these exist for is a machine that was off while
   * something happened. A job that only makes sense once the daemon has been up a while says so.
   */
  onStart?: boolean
}

/** The running clock. */
export interface DaemonTick {
  /** Run one tick now, awaiting it. The daemon's shutdown and the tests drive it through this. */
  tick: () => Promise<void>
  /**
   * Stop the clock, and resolve when the turn already in flight has finished. Awaiting it is how
   * a shutdown knows the sweeps have let go of the repo — clearing the interval only stops the
   * *next* turn, and these jobs commit and push.
   */
  stop: () => Promise<void>
}

/** How often the clock fires. The finest cadence any job asks for; everything else is a multiple. */
export const DAEMON_TICK_MS = 30_000

/** What {@link startDaemonTick} needs. */
export interface DaemonTickOptions {
  jobs: readonly TickJob[]
  /** Override the base interval (tests). */
  intervalMs?: number
  log: (message: string) => void
}

/**
 * Start the clock and return the handle that stops it.
 *
 * A job that throws costs its own turn and nothing else: the others in the same tick still run,
 * and the failure is logged once with the job's name, because a sweep failing silently is
 * indistinguishable from one that is not scheduled at all.
 *
 * Overlapping ticks join the one already running rather than being dropped, so awaiting `tick()`
 * means the tick finished — which is what lets a test drive this deterministically. The timer is
 * unref'd: background work is never the reason the process stays up.
 */
export function startDaemonTick(opts: DaemonTickOptions): DaemonTick {
  let stopped = false
  let count = 0
  let inflight: Promise<void> | undefined

  const runTick = async (): Promise<void> => {
    const n = count++
    for (const job of opts.jobs) {
      if (stopped) return
      const every = Math.max(1, job.every ?? 1)
      // Offset by one so a job with `every: 20` runs on tick 0 too when it wants a start-up turn,
      // and is skipped on tick 0 when it does not.
      if (n === 0 ? job.onStart === false : n % every !== 0) continue
      try {
        await job.run()
      } catch (err) {
        opts.log(`[framework] ${job.name} failed this tick: ${errorMessage(err)}`)
      }
    }
  }

  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    inflight ??= runTick().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  void tick()
  const timer = setInterval(() => void tick(), opts.intervalMs ?? DAEMON_TICK_MS)
  timer.unref?.()
  return {
    tick,
    stop: async () => {
      stopped = true
      clearInterval(timer)
      // The turn in flight stops at the next job boundary, but the job it is inside runs to the
      // end — so wait it out rather than leaving a sweep mid-commit.
      await inflight?.catch(() => {})
    },
  }
}
