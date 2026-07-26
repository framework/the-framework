import { describe, expect, test } from 'vitest'
import { weekDays, quotaTone, limitPercent, projectedRange } from './quota-bar.js'

// The bar's arithmetic. The default formatter is pinned to en-US on purpose (a localized short
// weekday sliced to two characters is not distinguishing in every locale), so these assertions
// hold on any machine and the last case here proves it rather than assuming it.
const weekday = (at: number) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(at).getDay()]!

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

describe('weekDays', () => {
  test('a week starting mid-day still shows each day exactly once (#960 Edit)', () => {
    // Tuesday evening, local time, which is the case the issue draws.
    const startsAt = new Date(2026, 6, 21, 19, 0, 0).getTime() // Tue 21 Jul 2026, 19:00 local
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    // Seven equal 24h stretches from the start moment, not seven calendar days — so the start
    // day's own 24h is one segment, not split into a sliver at each end of the bar.
    expect(days.map(d => d.label)).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO'])
  })

  test('a week starting exactly at midnight still shows each day exactly once', () => {
    const startsAt = new Date(2026, 6, 21, 0, 0, 0).getTime()
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days.map(d => d.label)).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO'])
  })

  test('each day is an equal seventh of the bar, edge to edge with no gap between them', () => {
    const startsAt = new Date(2026, 6, 21, 19, 0, 0).getTime()
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days[0]!.startPercent).toBe(0)
    expect(days.at(-1)!.endPercent).toBe(100)
    for (const d of days) expect(d.endPercent - d.startPercent).toBeCloseTo(100 / 7, 5)
    for (let i = 1; i < days.length; i++) expect(days[i]!.startPercent).toBe(days[i - 1]!.endPercent)
  })

  test('an empty or inverted span draws nothing rather than dividing by zero', () => {
    expect(weekDays(1000, 1000, weekday)).toEqual([])
    expect(weekDays(2000, 1000, weekday)).toEqual([])
  })
})

test('the built-in labels are a fixed two-letter notation, not the machine locale', () => {
  // On a he-IL machine every short weekday begins `יו`, so a localized axis would label all seven
  // days the same. The default formatter has to be locale-independent for the axis to mean anything.
  const startsAt = new Date(2026, 6, 21, 19, 0, 0).getTime()
  const labels = weekDays(startsAt, startsAt + WEEK_MS).map(d => d.label)
  expect(labels).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO'])
})

describe('quotaTone', () => {
  // The band exists so an account spending exactly as intended does not flip colour every day at
  // the moment the boundary steps a seventh.
  test('reads consumption against the boundary, with a band around it', () => {
    expect(quotaTone(10, 43)).toBe('under')
    expect(quotaTone(41, 43)).toBe('near')
    expect(quotaTone(46, 43)).toBe('near')
    expect(quotaTone(60, 43)).toBe('over')
    expect(quotaTone(100, 43)).toBe('full')
  })

  test('a spent week is full even when the boundary has caught up to it', () => {
    // Day seven allows the whole allowance, so "over" would be wrong here: nothing is left, which
    // is a different thing from spending too fast.
    expect(quotaTone(100, 100)).toBe('full')
    expect(quotaTone(99, 100)).toBe('near')
  })
})

describe('projectedRange', () => {
  // The bar's second, dimmer segment: the room between what's used and where unattended work is
  // allowed to stop.
  test('spans from what is used to the limit, when there is room left', () => {
    expect(projectedRange(20, 57)).toEqual({ start: 20, end: 57 })
  })

  test('is empty once the limit has already been reached or passed, not negative-width', () => {
    expect(projectedRange(80, 57)).toEqual({ start: 80, end: 80 })
  })

  test('clamps both ends to the bar itself', () => {
    expect(projectedRange(-10, 130)).toEqual({ start: 0, end: 100 })
  })
})
