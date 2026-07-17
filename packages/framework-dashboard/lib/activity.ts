import type { Activity } from '@gemstack/framework'

// Client-side helpers for the "New activity" notification trigger (#627). Like lib/interventions.ts,
// these live in the dashboard rather than @gemstack/framework on purpose: importing runtime values
// from the framework barrel would drag its Node-only + telefunc modules into the browser bundle.
// Only the `Activity` type is borrowed (types are erased), and the logic is a couple of lines.

/**
 * The stable identity of an activity item: kind + project + run. Mirrors the server's `activityKey`.
 * The kind is part of the key so a run's `started` and `finished` are two separate announcements.
 */
export function activityKey(item: Activity): string {
  return `${item.kind}:${item.projectId}:${item.runId}`
}

/**
 * The activity items in `current` not already in `seen` (by {@link activityKey}) — the transitions
 * that just happened. The shell keeps the keys it has already told the user about, so only genuinely
 * new run started/finished events fire a notification.
 */
export function pickNewActivity(seen: ReadonlySet<string>, current: Activity[]): Activity[] {
  return current.filter(item => !seen.has(activityKey(item)))
}
