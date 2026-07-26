// The usage bar's own arithmetic (#960), kept out of the component so it can be tested without a
// DOM and read without React. Everything here is about *drawing* the week; where the boundary sits
// and what it gates is the framework's (`quota-boundary.ts`), and this never re-derives it.

/** One quota-day's stretch of the bar, 0-100, and the label that names it, if any. */
export interface DaySegment {
  /** Where this day starts across the bar, 0 at the start of the quota week. */
  startPercent: number
  /** Where it ends — the next local midnight, or 100 for the last. */
  endPercent: number
  /**
   * The day's two-letter name, e.g. `TU`, or absent for the smaller of a mid-day start's two
   * same-named slivers (see {@link weekDays}) — delimited, but silent, so the day still reads once.
   */
  label?: string | undefined
}

/**
 * `TU` for a Tuesday, in the viewer's own zone.
 *
 * Deliberately not the viewer's locale. Two letters of a localized weekday is only distinguishing
 * in locales that happen to work like English: Hebrew's short weekdays are `יום א׳`..`יום ז׳`, so
 * slicing two characters labels all seven days identically. This axis is a fixed two-letter
 * notation, like a chart's, and the dates it stands for are spelled out in full elsewhere.
 */
function weekdayLabel(at: number): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(at).slice(0, 2).toUpperCase()
}

/**
 * The week as calendar days (#960 Edit): segments run local midnight to local midnight, so a
 * segment's width says how much of that day is actually in the week, and the axis places `TU`
 * where most of Tuesday is — not at a fixed seventh regardless of the clock.
 *
 * A mid-day start splits its own day into two slivers straddling the reset — the tail end right
 * after the week begins, and the whole day right before it resets a week later — and both are
 * named the same weekday. Both are still delimited (real elapsed time, worth a boundary), but only
 * the larger keeps its label, so the day still reads exactly once, at whichever end it mostly falls.
 *
 * Midnight is re-derived each step rather than added as 24h, so a DST change does not slide every
 * later boundary by an hour.
 */
export function weekDays(startsAt: number, resetsAt: number, weekday: (at: number) => string = weekdayLabel): DaySegment[] {
  const span = resetsAt - startsAt
  if (!(span > 0)) return []
  const bounds = [startsAt]
  const cursor = new Date(startsAt)
  cursor.setHours(24, 0, 0, 0)
  while (cursor.getTime() < resetsAt) {
    bounds.push(cursor.getTime())
    cursor.setHours(24, 0, 0, 0)
  }
  bounds.push(resetsAt)

  const days: DaySegment[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const segStart = bounds[i]!
    const segEnd = bounds[i + 1]!
    days.push({
      startPercent: ((segStart - startsAt) / span) * 100,
      endPercent: ((segEnd - startsAt) / span) * 100,
      label: weekday(segStart),
    })
  }

  const first = days[0]!
  const last = days.at(-1)!
  if (days.length > 1 && first.label === last.label) {
    const firstWidth = first.endPercent - first.startPercent
    const lastWidth = last.endPercent - last.startPercent
    if (firstWidth >= lastWidth) last.label = undefined
    else first.label = undefined
  }
  return days
}

/** How the week is going, which is the bar's colour. */
export type QuotaTone = 'under' | 'near' | 'over' | 'full'

/** Percentage points either side of the boundary that still count as "on track". */
const NEAR_BAND = 5

/**
 * Where consumption stands against the boundary.
 *
 * A band rather than a point, because the boundary moves a seventh of the week at a time: without
 * one the bar would flip from green to orange every day at the moment the boundary steps, on an
 * account that is spending exactly as intended.
 */
export function quotaTone(percentUsed: number, boundaryPercent: number, band = NEAR_BAND): QuotaTone {
  if (percentUsed >= 100) return 'full'
  if (percentUsed > boundaryPercent + band) return 'over'
  if (percentUsed >= boundaryPercent - band) return 'near'
  return 'under'
}

/**
 * Where the automatic-consumption limit sits, given the boundary and the user's offset.
 *
 * The daemon computes this too, and its answer is the one that gates the work. This exists so the
 * panel can draw the line the instant the slider moves, rather than a poll later: the drawn line
 * would otherwise trail the control by up to thirty seconds, which reads as a broken slider.
 */
export function limitPercent(boundaryPercent: number, offset: number): number {
  return Math.min(Math.max(boundaryPercent + offset, 0), 100)
}

/**
 * How far ahead of or behind the boundary's own pace consumption is, as a signed duration within
 * the week (#960 Edit): positive is ahead (over-consuming), negative is behind (under-consuming).
 * "53% used" read as a share of the *week* told a viewer almost nothing about whether today's pace
 * was being kept; a duration ("2h", "1d") says exactly how much of the week that gap actually is.
 */
export function paceDeviationMs(percentUsed: number, boundaryPercent: number, weekMs: number): number {
  return ((percentUsed - boundaryPercent) / 100) * weekMs
}

/**
 * The bar's second, dimmer segment (#960 Edit): the room between what has actually been used and
 * where unattended work is allowed to stop. Drawn at reduced opacity, right after the solid "used"
 * fill, so the two read as one bar split in two rather than a separate mark floating over it.
 *
 * Empty once the limit has already been reached or passed — there is no room left to project, and
 * a segment of negative width would just be the "used" fill's own edge again.
 */
export function projectedRange(percentUsed: number, limit: number): { start: number; end: number } {
  const start = Math.min(Math.max(percentUsed, 0), 100)
  const end = Math.max(start, Math.min(Math.max(limit, 0), 100))
  return { start, end }
}

