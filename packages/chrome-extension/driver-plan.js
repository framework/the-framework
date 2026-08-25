// Which watched sessions the Driver tab visits this cycle (#1332). Shared by the service worker,
// which decides, and the offline harness, which pins the rule; loaded as a plain script in both.
//
// The rule exists because claude.ai's list statuses are sticky: an in-app visit clears neither
// "Awaiting input" nor "Unread response" (measured 2026-08-25), so visiting every parked session
// on every cycle would mean 50 visits every half minute for 50 agents. A parked session is visited
// when its status changed since the last read, when it has not been visited for a while, and
// always when the dashboard queued an answer for it — that is the one thing the list cannot know.

/** How long a session the list keeps calling parked waits before being looked at again. */
const REVISIT_MS = 5 * 60_000

/** The list statuses that mean the session stopped for its user. */
const PARKED = new Set(['awaiting', 'unread'])

/**
 * `statuses`: what the list said, `[{sessionId, status}]`. `answers`: a map of session id to the
 * queued answer. `seen`: a map of session id to `{status, visitedAt}` from earlier cycles. Returns
 * the visits in list order, each `{id, status, answer?}`.
 */
function planVisits(statuses, answers, seen, now, revisitMs = REVISIT_MS) {
  const visits = []
  for (const { sessionId, status } of statuses) {
    const answer = answers.get(sessionId)
    const last = seen.get(sessionId)
    const changed = !last || last.status !== status
    const stale = !last || now - (last.visitedAt ?? 0) >= revisitMs
    const due = PARKED.has(status) && (changed || stale)
    if (answer || due) visits.push({ id: sessionId, status, ...(answer ? { answer } : {}) })
  }
  return visits
}

// The worker loads this with importScripts, where a top-level function is already global; jsdom
// evaluates it the same way. Nothing else to export.
if (typeof globalThis !== 'undefined') globalThis.__tfPlanVisits = planVisits
