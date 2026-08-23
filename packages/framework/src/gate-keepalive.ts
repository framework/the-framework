/**
 * Holds the Node event loop open while the agent is parked on the user (#1359).
 *
 * A daemon-spawned agent has nothing ref'd at a parked gate: the daemon spawns it detached with
 * every stdio ignored and `--no-dashboard` (so no server), the claude-code driver spawns and
 * reaps a child per prompt (so nothing runs between turns), and the control watcher is
 * deliberately unref'd so steering alone never keeps a finished agent alive (#344). The moment
 * `requestChoice` parked a bare Promise between turns, the event loop was empty and Node exited
 * 0 mid-await — no `end` event, empty stderr, and picks landing in `control.jsonl` that nothing
 * would ever read. The same silently-unwired-channel family as #905/#922, one layer down: the
 * channel was wired, but the process waiting on it was not held.
 *
 * This is the narrow inverse of the watcher's unref: a ref'd (but idle) interval that exists
 * only while at least one held promise is pending. Waiting for the answer IS the agent's work at
 * that moment, so holding the loop is correct exactly there — and nowhere else, which is why the
 * watcher itself stays unref'd (the actions-abort hang is what unref'ing it fixed).
 */

/** The slice of a timer handle the keepalive needs; `hasRef` is what a test asserts on. */
export interface KeepaliveTimer {
  hasRef?(): boolean
}

/** The timer seam, injected by tests so nothing waits on real time. */
export interface KeepaliveTimers {
  /** Start the loop-holding timer. Must return a ref'd handle. */
  start(): KeepaliveTimer
  /** Stop a timer {@link start} returned. */
  stop(timer: KeepaliveTimer): void
}

/**
 * The idle interval's period. The callback never matters — only the ref does — so it is set far
 * beyond any run's life to make the no-op wakeups free.
 */
const IDLE_INTERVAL_MS = 2 ** 30

/**
 * The real timers: a ref'd no-op interval (`setInterval` refs by default — the ref IS the
 * fix, so a test asserts `hasRef()` on what `start` returns rather than trusting this comment).
 */
export const nodeKeepaliveTimers: KeepaliveTimers = {
  start: () => setInterval(() => {}, IDLE_INTERVAL_MS),
  stop: timer => clearInterval(timer as NodeJS.Timeout),
}

/** A live keepalive. One per agent process; every parked wait shares it. */
export interface GateKeepalive {
  /** Pass a parked promise through; the loop is held until it settles (resolve or reject). */
  hold<T>(pending: Promise<T>): Promise<T>
  /** How many holds are currently pending. */
  held(): number
}

/**
 * Create the agent's keepalive. Counter-based: the first pending hold starts one ref'd idle
 * timer, overlapping holds share it, and the last one to settle stops it — so the process can
 * exit the moment nothing is parked, exactly as before this existed.
 */
export function createGateKeepalive(timers: KeepaliveTimers = nodeKeepaliveTimers): GateKeepalive {
  let held = 0
  let timer: KeepaliveTimer | undefined
  const acquire = (): void => {
    if (held++ === 0) timer = timers.start()
  }
  const release = (): void => {
    if (--held === 0 && timer) {
      timers.stop(timer)
      timer = undefined
    }
  }
  return {
    held: () => held,
    async hold(pending) {
      acquire()
      try {
        return await pending
      } finally {
        release()
      }
    },
  }
}
