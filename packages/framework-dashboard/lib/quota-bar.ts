// The usage bar's own arithmetic (#960), kept out of the component so it can be tested without a
// DOM and read without React. Everything here is about *drawing* the week; where the boundary sits
// and what it gates is the framework's (`quota-boundary.ts`), and this never re-derives it.

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

