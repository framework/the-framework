import { describe, expect, test } from 'vitest'
import { quotaTone, limitPercent, projectedRange } from './quota-bar.js'

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
