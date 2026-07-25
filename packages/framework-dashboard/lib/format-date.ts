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
 * How long until `at` (epoch ms), as "in 4 min" / "in 1 hr". Past due reads as "any moment": a
 * schedule the daemon has not reached yet is imminent, not late. Shared by the usage panel's
 * next-sweep line (#1161) and the routines card's auto-run label (#1159).
 */
export function formatUntil(at: number): string {
  const minutes = Math.round((at - Date.now()) / 60_000)
  if (minutes <= 0) return 'any moment'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  return `in ${hours} hr`
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
