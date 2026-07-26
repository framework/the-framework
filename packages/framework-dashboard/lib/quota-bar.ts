// The usage bar's own arithmetic (#960), kept out of the component so it can be tested without a
// DOM and read without React. Everything here is about *drawing* the week; where the boundary sits
// and what it gates is the framework's (`quota-boundary.ts`), and this never re-derives it.

/** One quota-day's stretch of the bar, 0-100, and the label that names it. */
export interface DaySegment {
  /** Where this day starts across the bar, 0 at the start of the quota week. */
  startPercent: number
  /** Where it ends — the next day's start, or 100 for the last. */
  endPercent: number
  /** The day's two-letter name, e.g. `TU`, read at the segment's own start. */
  label: string
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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The week as seven equal quota-days (#960 Edit).
 *
 * Each is a full 24h from the account's own start moment, not a calendar day — the week starts
 * whenever the account's does, generally mid-day, so a segment runs (say) Tuesday evening to
 * Wednesday evening and is still labelled `TU`, the day it started. That is what keeps every day
 * shown exactly once: the earlier axis walked local midnights instead, which split the start day's
 * 24h into two separate slivers (one at each end of the bar) and so had to draw `TU` twice.
 */
export function weekDays(startsAt: number, resetsAt: number, weekday: (at: number) => string = weekdayLabel): DaySegment[] {
  const span = resetsAt - startsAt
  if (!(span > 0)) return []
  const days = Math.max(1, Math.round(span / DAY_MS))
  return Array.from({ length: days }, (_, i) => ({
    startPercent: (i / days) * 100,
    endPercent: ((i + 1) / days) * 100,
    label: weekday(startsAt + i * DAY_MS),
  }))
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

/** What each tone means, in the words the panel says out loud. */
export const TONE_NOTE: Record<QuotaTone, string> = {
  under: 'Under the line, with room to spend.',
  near: 'Tracking with the week.',
  over: 'Ahead of the week, so unattended work stands down until the line catches up.',
  full: 'The week is spent.',
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

