import { contextAutoPm, contextAutoPmSweep, contextQuota } from './context.js'
import type { AutoPmOutcome, AutoPmReport } from '../auto-pm.js'
import type { QuotaView } from '../dashboard/quota.js'

// The usage panel's read surface (#533): where the account's subscription quota stands, and where
// it stands against the quota boundary (#879). The source is wired into the dashboard context by
// the daemon, and the panel polls it for its whole life.

/** An honest empty view: no reading, and so no boundary to measure against. */
function noReading(): QuotaView {
  // No windows and no boundary rather than zeroes: an empty bar reads as
  // "nothing used", which is the one thing this panel must never imply.
  return { windows: [], unavailable: 'fetch-failed' }
}

/** Where the account's quota stands against its boundary. */
export async function onQuota(): Promise<QuotaView> {
  return contextQuota().read().catch(() => noReading())
}

/**
 * What auto PM last decided (#1161), for the line under the panel's toggle. It sits beside
 * `onQuota` because it is the same panel and the same gate: auto PM spends against exactly the
 * boundary drawn above it.
 *
 * `undefined` when the loop has nothing to report yet, which the panel reads as "nothing to say"
 * rather than as an idle sweep — the distinction this whole read exists to make.
 */
export async function onAutoPm(): Promise<AutoPmReport | undefined> {
  try {
    return contextAutoPm()()
  } catch {
    return undefined
  }
}

/**
 * Sweep now rather than at the next interval (#1210). The loop already had this — it is what a
 * write that switches the preference on triggers (#1167) — but until now nothing could ask for
 * it directly, so the only way to fast-forward was to tick the box off and on again.
 *
 * The `autoPm` preference does not gate it: that preference is consent to spend quota *unasked*,
 * and this call is asking. So with auto-run off the daemon still sweeps once — every other
 * stand-down reason in force — and the schedule stays wherever the box says.
 *
 * Awaits the sweep and returns what it decided, one line per project (#1433): the click used to
 * be fire-and-forget, so two presses could show literally nothing — no loading state, no
 * outcome, and the stand-down reason recoverable only from the source. The outcomes are read
 * off the loop's own report once the tick resolves, so the card can say them without a poll
 * having to race the sweep. `false` means the sweep itself failed.
 *
 * `drainOnly` narrows the sweep to working the queue (#1204): the drain routine's Run now spins
 * agents up on the queue's entries — the fan-out only the sweep can do — and an empty queue is
 * reported rather than borrowed for a rotation job.
 */
export async function sendAutoPmSweep(opts?: { drainOnly?: boolean }): Promise<{ ok: boolean; outcomes?: AutoPmOutcome[] }> {
  const sweep = contextAutoPmSweep()
  // The reporter is captured BEFORE the sweep is awaited. It had to be: the context was
  // request-scoped and did not survive an await, so a post-await `contextAutoPm()` found nothing
  // on every real request and the card fell back to "The sweep ran." — the very fallback this RPC
  // exists to avoid. The context is wired once at start-up now (F3), so the order is no longer
  // load-bearing; the captured closure needs no context to be called later either way.
  const reporter = contextAutoPm()
  try {
    await sweep(opts?.drainOnly ? { drainOnly: true } : undefined)
  } catch {
    return { ok: false }
  }
  // The outcomes live on the loop's report — the same lines `onAutoPm` polls — read once the
  // tick has resolved, so they describe the sweep this click fired.
  try {
    const report = reporter()
    return { ok: true, ...(report ? { outcomes: report.outcomes } : {}) }
  } catch {
    return { ok: true }
  }
}
