import type { RunMeta } from '../store/index.js'
import type { BridgeSession } from './bridge-endpoints.js'

/** How far back a cloud run is still worth having a tab open for. */
export const BRIDGE_SESSION_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * At most this many tabs. The extension opens one per session, and a browser that quietly
 * accumulates tabs is worse than a bridge that misses an old run.
 */
export const BRIDGE_SESSION_LIMIT = 3

/**
 * Which cloud sessions the extension should be watching (#1237).
 *
 * Recency is the whole filter, and it has to be, because a web run's status tells us nothing:
 * #1231 ends the run at the hand-off, so every one of them reads `done` whether its session is
 * parked on a question or finished an hour ago. There is no read-back that would say which, so
 * the honest rule is "recent, and not many", rather than a liveness check we cannot perform.
 */
export function bridgeSessionsFrom(runs: readonly RunMeta[], now: Date, windowMs = BRIDGE_SESSION_WINDOW_MS, limit = BRIDGE_SESSION_LIMIT): BridgeSession[] {
  const cutoff = now.getTime() - windowMs
  const seen = new Set<string>()
  const out: { session: BridgeSession; at: number }[] = []
  for (const run of runs) {
    if (run.target !== 'web' || !run.sessionId) continue
    const at = Date.parse(run.startedAt ?? '')
    if (!Number.isFinite(at) || at < cutoff) continue
    if (seen.has(run.sessionId)) continue
    seen.add(run.sessionId)
    out.push({ session: { id: run.sessionId, url: `https://claude.ai/code/${run.sessionId}` }, at })
  }
  return out
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(entry => entry.session)
}
