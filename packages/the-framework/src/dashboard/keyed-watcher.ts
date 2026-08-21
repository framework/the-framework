import type { ProjectSummary, ProjectionRead } from './projects.js'

// The daemon-side half of notifications (#627): a background poll of a projection over the
// registered projects that fires even when no dashboard is open — that is what a Discord
// message buys over the browser notification. One engine, two callers: the "needs you" queue
// (#627) and the "New activity" feed. They differ only in what they project and how an item
// is identified, so those are parameters rather than a second copy of the poll.

/**
 * Tracks which items have been announced, so only new ones notify. Identity is the caller's
 * (`keyOf`), since what makes two items "the same" is a property of what is being watched.
 * Testable without timers.
 *
 * The baseline is kept per project (`scopeOf`), not once for the whole poll (#1623). A poll that
 * reached three projects out of four knows what already existed on those three and knows nothing
 * about the fourth, and announcing is a per-project decision anyway. Held globally, one project
 * that can never be read — a registered repo with no remote is an ordinary case — would either
 * silence every project's notifications or hand the whole set a baseline it had not earned.
 */
export class SeenTracker<T> {
  private readonly seen = new Set<string>()
  private readonly warmedUp = new Set<string>()

  constructor(
    private readonly keyOf: (item: T) => string,
    private readonly scopeOf: (item: T) => string,
  ) {}

  /**
   * Fold a poll's items into the baseline and return the ones worth announcing: the items not seen
   * before, from projects this watcher has a real baseline for. `whole` names the projects the poll
   * read completely, and only those earn a baseline — so whatever already existed at start-up is
   * never announced, and a project that could not be read stays quiet until it can be.
   *
   * Items keep being folded in either way: a partial read can only under-report, never invent, so
   * anything it did see is still something the user should not later hear about as new.
   */
  observe(items: T[], whole: Iterable<string>): T[] {
    const fresh = items.filter(
      item => this.warmedUp.has(this.scopeOf(item)) && !this.seen.has(this.keyOf(item)),
    )
    for (const item of items) this.seen.add(this.keyOf(item))
    for (const project of whole) this.warmedUp.add(project)
    return fresh
  }
}

/** A running watcher; call {@link KeyedWatcher.stop} to end it. */
export interface KeyedWatcher {
  stop: () => void
  /** Run one poll now. Exposed so the daemon and tests can drive it deterministically. */
  poll: () => Promise<void>
}

/** Options for {@link startKeyedWatcher}. */
export interface KeyedWatcherOptions<T> {
  /** The projects to scan each poll (the daemon passes the registry, mapped to summaries). */
  projects: () => Promise<ProjectSummary[]>
  /**
   * Project the scanned projects into the items being watched, and name the projects that were read
   * whole — the ones whose share of the items is all of it, rather than all that could be reached.
   */
  build: (projects: ProjectSummary[]) => Promise<ProjectionRead<T>>
  /** The stable identity of an item, so the same one is only ever announced once. */
  keyOf: (item: T) => string
  /** Which project an item belongs to: the baseline is kept per project (#1623). */
  scopeOf: (item: T) => string
  /** Called with the genuinely-new items each poll (empty polls are skipped). */
  onNew: (items: T[]) => void | Promise<void>
}

/**
 * Watch a projection and hand each poll's new items to `onNew`. A project's first *whole* read only
 * seeds that project's baseline. Forgiving — a failed project scan or projection just yields no new
 * items that cycle, and earns no baseline: the baseline must come from a real read, or a first poll
 * that could not reach GitHub would make the next good one announce everything pre-existing as new.
 *
 * Owns no timer (E4): the daemon's one clock calls {@link KeyedWatcher.poll}, so the cadence is
 * declared where every other background job's is.
 */
export function startKeyedWatcher<T>(opts: KeyedWatcherOptions<T>): KeyedWatcher {
  const tracker = new SeenTracker(opts.keyOf, opts.scopeOf)
  let stopped = false
  let running = false

  const poll = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      let read: ProjectionRead<T>
      try {
        read = await opts.build(await opts.projects())
      } catch {
        return
      }
      const fresh = tracker.observe(read.items, read.whole)
      if (fresh.length > 0 && !stopped) await opts.onNew(fresh)
    } finally {
      running = false
    }
  }

  return {
    stop: () => {
      stopped = true
    },
    poll,
  }
}
