import { describe, expect, test } from 'vitest'
import { weekDays, quotaTone, limitPercent, projectedRange } from './quota-bar.js'

// The bar's arithmetic. The default formatter is pinned to en-US on purpose (a localized short
// weekday sliced to two characters is not distinguishing in every locale), so these assertions
// hold on any machine and the last case here proves it rather than assuming it.
const weekday = (at: number) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(at).getDay()]!

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

describe('weekDays', () => {
  test('a week starting mid-day labels most of TU at the end of the bar, not the start (#960 Edit)', () => {
    // Tuesday evening, local time, which is the case the issue draws: reset is also a Tuesday, a
    // week later, and the 19 hours right before it are more of Tuesday than the 5-hour sliver
    // right after the week begins.
    const startsAt = new Date(2026, 6, 21, 19, 0, 0).getTime() // Tue 21 Jul 2026, 19:00 local
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days.map(d => d.label)).toEqual([undefined, 'WE', 'TH', 'FR', 'SA', 'SU', 'MO', 'TU'])
    // Each day still reads exactly once, filtering the unlabelled sliver out.
    expect(days.map(d => d.label).filter(Boolean)).toEqual(['WE', 'TH', 'FR', 'SA', 'SU', 'MO', 'TU'])
    // The labelled `TU` is the 19h segment right before the reset, not the 5h one at the start.
    const tu = days.at(-1)!
    expect(tu.endPercent - tu.startPercent).toBeGreaterThan(days[0]!.endPercent - days[0]!.startPercent)
  })

  test('a week starting just after midnight labels TU at the start instead, since that sliver is the bigger one', () => {
    // Tuesday 2am: the 22h sliver from here to the next midnight dwarfs the 2h sliver of Tuesday
    // that reappears right before the reset, so the label belongs at the start this time.
    const startsAt = new Date(2026, 6, 21, 2, 0, 0).getTime()
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days.map(d => d.label)).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO', undefined])
    expect(days.map(d => d.label).filter(Boolean)).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO'])
  })

  test('a week starting exactly at midnight has no sliver to dedupe, and every day is an equal seventh', () => {
    const startsAt = new Date(2026, 6, 21, 0, 0, 0).getTime()
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days.map(d => d.label)).toEqual(['TU', 'WE', 'TH', 'FR', 'SA', 'SU', 'MO'])
    for (const d of days) expect(d.endPercent - d.startPercent).toBeCloseTo(100 / 7, 5)
  })

  test('segments tile the bar edge to edge, whatever their individual widths', () => {
    const startsAt = new Date(2026, 6, 21, 19, 0, 0).getTime()
    const days = weekDays(startsAt, startsAt + WEEK_MS, weekday)
    expect(days[0]!.startPercent).toBe(0)
    expect(days.at(-1)!.endPercent).toBe(100)
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
  const labels = weekDays(startsAt, startsAt + WEEK_MS)
    .map(d => d.label)
    .filter(Boolean)
  expect(labels).toEqual(['WE', 'TH', 'FR', 'SA', 'SU', 'MO', 'TU'])
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
