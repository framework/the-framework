import { describe, expect, test, vi } from 'vitest'
import { formatAge, formatDate, formatDateTime, formatUntil } from './format-date.js'

describe('format-date (#759)', () => {
  test('formats a real timestamp', () => {
    const at = '2026-07-19T14:55:16.905Z'
    expect(formatDateTime(at)).toBe(new Date(at).toLocaleString())
    expect(formatDate(at)).toBe(new Date(at).toLocaleDateString())
  })

  test('an absent timestamp reads as the fallback, never "Invalid Date"', () => {
    expect(formatDateTime(undefined)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  test('an unparseable timestamp reads as the fallback too', () => {
    // A LOGS.md heading carries its `at` verbatim, so a hand-edited one lands here as-is.
    expect(formatDateTime('not a date')).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })

  test('the caller can word the fallback', () => {
    expect(formatDateTime(undefined, 'no activity yet')).toBe('no activity yet')
    expect(formatDateTime('nonsense', 'no activity yet')).toBe('no activity yet')
  })
})

describe('formatAge (#1139)', () => {
  const NOW = new Date('2026-07-25T12:00:00.000Z')
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
  const S = 1000
  const M = 60 * S
  const H = 60 * M
  const D = 24 * H

  test('names seconds, minutes, hours, days, weeks and years, floored', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    try {
      expect(formatAge(ago(22 * S))).toBe('22s ago')
      expect(formatAge(ago(0))).toBe('0s ago')
      // 90s is a minute and a half — floored to one minute, not rounded up to two.
      expect(formatAge(ago(90 * S))).toBe('1m ago')
      expect(formatAge(ago(30 * M))).toBe('30m ago')
      expect(formatAge(ago(3 * H))).toBe('3h ago')
      expect(formatAge(ago(5 * D))).toBe('5d ago')
      expect(formatAge(ago(14 * D))).toBe('2w ago')
      expect(formatAge(ago(400 * D))).toBe('1y ago')
    } finally {
      vi.useRealTimers()
    }
  })

  test('an absent or unparseable timestamp reads as the fallback', () => {
    expect(formatAge(undefined)).toBe('—')
    expect(formatAge('not a date')).toBe('—')
    expect(formatAge(undefined, 'never')).toBe('never')
  })
})

describe('formatUntil (#1161/#1159)', () => {
  test('counts down in minutes, then in hours', () => {
    expect(formatUntil(Date.now() + 4 * 60_000)).toBe('in 4 min')
    expect(formatUntil(Date.now() + 2 * 60 * 60_000)).toBe('in 2 hr')
  })

  test('a schedule already due reads as imminent, not as late', () => {
    // The daemon ticks on its own clock, so "past due" here only ever means "about to happen".
    expect(formatUntil(Date.now() - 60_000)).toBe('any moment')
    expect(formatUntil(Date.now())).toBe('any moment')
  })
})
