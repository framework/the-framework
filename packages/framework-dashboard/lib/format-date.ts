// Timestamps reach the UI as plain strings: a run's `startedAt` from the store, a log
// entry's `at` read verbatim out of a LOGS.md heading. Nothing validates them on the way
// in, and `new Date(...).toLocaleString()` renders anything it cannot parse as the literal
// "Invalid Date" (#759). So every display site formats through here, and an absent or
// unparseable timestamp reads as the fallback instead.

/** The parsed date, or undefined when there is nothing usable to show. */
function parse(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** A timestamp as local date + time, e.g. a project's last activity. */
export function formatDateTime(value: string | undefined, fallback = '—'): string {
  const date = parse(value)
  return date ? date.toLocaleString() : fallback
}

/**
 * A short local date + time, e.g. "Jul 18, 10:35 PM". For places where the timestamp is standing
 * in as a name (an unnamed session in the rail), where seconds are noise on the line that has to
 * identify the row.
 */
export function formatDateTimeShort(value: string | undefined, fallback = '—'): string {
  const date = parse(value)
  return date
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : fallback
}

/** A timestamp as a local date alone, for the denser table columns. */
export function formatDate(value: string | undefined, fallback = '—'): string {
  const date = parse(value)
  return date ? date.toLocaleDateString() : fallback
}

/**
 * A compact age (#1139): "22s ago" / "30m ago" / "5d ago" / "2w ago", the units the Agents list
 * dates its rows in. Finer than {@link formatRelative} at both ends — it names seconds (a session
 * that ended moments ago) and never falls back to a bare date (weeks, then years, stay relative) —
 * so a row reads the same whether it finished this minute or last month. Pair it with
 * {@link formatDateTime} in a `title` for the exact moment.
 *
 * Floored, not rounded: "1m ago" should mean at least a minute has passed, not "closer to a minute
 * than to two".
 */
export function formatAge(value: string | undefined, fallback = '—'): string {
  const date = parse(value)
  if (!date) return fallback
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 52) return `${weeks}w ago`
  return `${Math.floor(days / 365)}y ago`
}

/**
 * A timestamp as freshness (#948): "just now" / "12m ago" / "3h ago" / "2d ago", falling back
 * to the local date past a week. An at-a-glance board wants "2m ago", not today's date.
 */
export function formatRelative(value: string | undefined, fallback = '—'): string {
  const date = parse(value)
  if (!date) return fallback
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days <= 7) return `${days}d ago`
  return date.toLocaleDateString()
}
