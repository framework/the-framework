import { describe, expect, test } from 'vitest'
import { quotaTone, limitPercent, projectedRange, paceDeviationMs } from './quota-bar.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

describe('paceDeviationMs', () => {
  // A signed duration within the week — positive ahead (over-consuming), negative behind
  // (under-consuming) — so a viewer reads "2h" or "1d" instead of a percentage of the week that
  // says nothing about whether today's pace was kept.
  test('reads zero exactly on the boundary\'s pace', () => {
    expect(paceDeviationMs(57, 57, WEEK_MS)).toBe(0)
  })

  test('reads positive when ahead of pace, in real time within the week', () => {
    // A seventh of the week ahead is exactly one day.
    expect(paceDeviationMs(100 / 7 + 20, 20, WEEK_MS)).toBeCloseTo(WEEK_MS / 7, 5)
  })

  test('reads negative when behind pace', () => {
    // Two sevenths of the week behind is two days, the other way.
    expect(paceDeviationMs(20 - (2 * 100) / 7, 20, WEEK_MS)).toBeCloseTo((-2 * WEEK_MS) / 7, 5)
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
