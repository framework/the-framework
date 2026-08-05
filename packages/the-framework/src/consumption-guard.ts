import { QuotaPoller } from './quota-poller.js'
import { quotaBoundaryStatus } from './quota-boundary.js'
import { DEFAULT_SPEND_OFFSET } from './preference-defaults.js'
import type { Driver } from './driver/index.js'

/** A live quota gate, and the polling behind it. */
export interface ConsumptionGuard {
  /**
   * Pass as `consumptionGate` to a run. Answers from the poller's cached
   * readings, so it is cheap enough to ask between every turn. The label of the
   * window that reached the limit in force (the boundary plus its half-day
   * cushion, #960 Edit), or null while there is room.
   */
  gate: () => string | null
  /** The poller feeding it, exposed so a caller can read the windows off it. */
  poller: QuotaPoller
  /** Stop polling. Always call this when the run ends. */
  stop: () => void
}

/** Options for {@link startConsumptionGuard}. */
export interface StartConsumptionGuardOptions {
  /** The wrapped agent. Must be able to report its quota, or there's nothing to guard with. */
  driver: Driver
  /** The model the run is on. Brings that model's own weekly window into the gate (#879). */
  model?: string
  /**
   * The user's spend-limit offset — the #960 slider — read fresh around each gate check so
   * dragging it unblocks a parked run's next boundary check without a restart (#1490). It only
   * ever LOOSENS the gate (see the gate's comment); absent or unreadable means the default
   * policy, the same fallback the daemon's quota source uses.
   */
  limitOffset?: () => number | Promise<number>
  /** Clock, injectable for tests. */
  now?: () => number
}

/**
 * Wire the quota boundary up for one run (#879): poll the agent's quota, and
 * hand back the gate a run consults between turns.
 *
 * The boundary is derived from the account's own week, so there is nothing to
 * configure and nothing to remember between restarts: it is a comparison of two
 * numbers the agent reports, not a total we accumulate.
 *
 * Resolves `undefined` when there is nothing to guard with — the agent can't
 * report a quota at all (the fake driver, or a second agent that has no such
 * command). That is the fail-open Rom confirmed on #519: no reading means the
 * work carries on, with the per-run budget cap still underneath it. The gate
 * itself fails open for the same reason, which is the opposite of the auto-PM
 * gate: this one guards work the user asked for.
 *
 * The first read is deliberately not awaited. It takes ~5s (it spawns the whole
 * agent CLI), and making every run wait that long to *maybe* find out it has
 * budget would be a poor trade. It lands a moment into the run instead.
 */
export function startConsumptionGuard(opts: StartConsumptionGuardOptions): ConsumptionGuard | undefined {
  const readQuota = opts.driver.readQuota?.bind(opts.driver)
  if (!readQuota) return undefined

  const now = opts.now ?? (() => Date.now())
  const poller = new QuotaPoller({ read: () => readQuota(), now })
  poller.start()

  // The slider's latest resolved value. The gate stays synchronous — it answers from cached
  // readings — so the offset is refreshed in the background around each check and the check
  // uses the last value that landed: one turn behind at worst, which is also how fresh the
  // quota reading itself is.
  let userOffset = DEFAULT_SPEND_OFFSET
  const refreshOffset = () => {
    if (!opts.limitOffset) return
    void Promise.resolve()
      .then(opts.limitOffset)
      .then(value => {
        if (Number.isFinite(value)) userOffset = value
      })
      .catch(() => {}) // an unreadable registry means the default policy
  }
  refreshOffset()

  return {
    poller,
    stop: () => poller.stop(),
    gate: () => {
      refreshOffset()
      const windows = poller.current().lastGood?.windows
      if (!windows) return null
      // The same half-day cushion unattended work gets by default (#960 Edit). The continuous
      // boundary starts the week at zero, so without one the first integer percent the agent
      // reports outruns it and the user's own first run of the week is paused over ordinary
      // rounding — the stepped line this replaces always kept the current day's seventh in hand.
      // The user's slider joins the gate only when it LOOSENS it (#1490): raising the limit must
      // unblock the runs the Usage bar says have room — the bar and this gate disagreeing is the
      // exact thing #960 forbids — but lowering it sets where *unattended* work stands down, and
      // holding it back must never tighten the gate on work the user asked for.
      const limitOffset = Math.max(DEFAULT_SPEND_OFFSET, userOffset)
      const status = quotaBoundaryStatus({ windows, now: now(), limitOffset, ...(opts.model ? { model: opts.model } : {}) })
      return status?.reached?.label ?? null
    },
  }
}
