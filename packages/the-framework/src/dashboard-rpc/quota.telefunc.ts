import { contextAutoPm, contextAutoPmSweep, contextQuota } from './context.js'
import type { AutoPmReport } from '../auto-pm.js'
import type { QuotaView } from '../dashboard/quota.js'

// The usage panel's read surface (#533): where the account's subscription quota stands,
// and where it stands against the quota boundary (#879). The source is threaded through
// the Telefunc request context by the daemon, which polls for its whole life; a public
// host (the relay) leaves it unwired, so the panel reports it has no reading rather than
// an empty one.

/** An honest empty view: no reading, and so no boundary to measure against. */
function noReading(): QuotaView {
  // No windows and no boundary rather than zeroes: an empty bar reads as
  // "nothing used", which is the one thing this panel must never imply.
  return { windows: [], unavailable: 'fetch-failed' }
}

/** Where the account's quota stands against its boundary. */
export async function onQuota(): Promise<QuotaView> {
  const source = contextQuota()
  if (!source) return noReading()
  return source.read().catch(() => noReading())
}

/**
 * What auto PM last decided (#1161), for the line under the panel's toggle. It sits beside
 * `onQuota` because it is the same panel and the same gate: auto PM spends against exactly the
 * boundary drawn above it.
 *
 * `undefined` on a host with no sweep (the relay), which the panel reads as "nothing to say"
 * rather than as an idle sweep — the distinction this whole read exists to make.
 */
export async function onAutoPm(): Promise<AutoPmReport | undefined> {
  const report = contextAutoPm()
  if (!report) return undefined
  try {
    return report()
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
 * Returns whether a sweep was asked for, not what it decided: a sweep can start runs and take a
 * while, and `onAutoPm` is how the answer arrives. `false` on a host with no loop (the relay),
 * which the button reads as "nothing here to trigger".
 */
export async function sendAutoPmSweep(): Promise<{ ok: boolean }> {
  const sweep = contextAutoPmSweep()
  if (!sweep) return { ok: false }
  try {
    sweep()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
