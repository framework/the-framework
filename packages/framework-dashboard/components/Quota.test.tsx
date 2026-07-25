import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AutoPmReport, Preferences, QuotaView } from '@gemstack/the-framework'

const updatePreferences = vi.hoisted(() => vi.fn())
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs,
  updatePreferences,
}))

let view: QuotaView | undefined
let autoPm: AutoPmReport | undefined
vi.mock('../lib/quota.js', () => ({ useQuota: () => view, useAutoPm: () => autoPm }))

const { Quota } = await import('./Quota.js')

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const STARTS_AT = new Date(2026, 6, 21, 19, 0, 0).getTime() // Tue evening, the mid-day-start case

/** A reading with a placeable week, so the bar has an axis to draw. */
function reading(percentUsed: number, limitOffset = 0): QuotaView {
  const boundaryPercent = (4 / 7) * 100 // day four of seven
  return {
    windows: [
      { label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: 'Jul 28 at 7pm' },
      { label: 'Current session', kind: 'session', percentUsed: 3 },
    ],
    boundary: {
      boundary: { startsAt: STARTS_AT, resetsAt: STARTS_AT + WEEK_MS, day: 4, percent: boundaryPercent },
      limit: { percent: Math.min(Math.max(boundaryPercent + limitOffset, 0), 100), offset: limitOffset },
      windows: [{ label: 'Current week (all models)', percentUsed, reached: false }],
      reached: null,
    },
  }
}

beforeEach(() => {
  prefs = {}
  view = undefined
  autoPm = undefined
  updatePreferences.mockReset()
})
afterEach(cleanup)

describe('Quota (#960)', () => {
  test('says it is reading rather than drawing an empty week', () => {
    render(<Quota />)
    // An empty track would read as "nothing used", which is the opposite of "we do not know yet".
    expect(screen.getByText(/Reading your usage/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('draws the week as one track, labelled with where consumption stands', () => {
    view = reading(20)
    render(<Quota />)
    const bar = screen.getByRole('img')
    expect(bar.getAttribute('aria-label')).toMatch(/20% of the week used/)
    expect(bar.getAttribute('aria-label')).toMatch(/boundary of 57%/)
    expect(bar.getAttribute('aria-label')).toMatch(/day 4 of 7/)
  })

  test('the start day appears at both ends of a week that began mid-day', () => {
    view = reading(20)
    render(<Quota />)
    // The week is seven times twenty-four hours from a Tuesday evening, so it both opens and
    // closes on a Tuesday. Eight labels, TU first and TU last.
    const labels = screen.getAllByText(/^[A-Z]{2}$/).map(el => el.textContent)
    expect(labels).toHaveLength(8)
    expect(labels[0]).toBe(labels.at(-1))
  })

  test('the session window is listed, but never as the bar', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.getByText('Current session')).toBeTruthy()
    // One bar, and it is the account's week.
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  test('the slider writes an offset from the boundary, not an absolute percentage (#960)', () => {
    view = reading(20)
    prefs = {}
    render(<Quota />)
    const slider = screen.getByLabelText('Unattended work stops at')
    expect((slider as HTMLInputElement).value).toBe('0')
    fireEvent.change(slider, { target: { value: '15' } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoSpendOffset: 15 })
  })

  test('a moved limit is shown as a line of its own, and named', () => {
    view = reading(20, 15)
    render(<Quota />)
    // 57% boundary + 15 = 72%, and the caption says which of the two it is.
    expect(screen.getByText(/72%/)).toBeTruthy()
    expect(screen.getByText(/\+15 on the boundary/)).toBeTruthy()
  })

  test('an unreadable quota explains itself instead of showing a zeroed bar', () => {
    view = { windows: [], unavailable: 'agent-not-found' }
    render(<Quota />)
    expect(screen.getByText(/Claude Code was not found/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    // And no slider: there is no line to move.
    expect(screen.queryByLabelText('Unattended work stops at')).toBeNull()
  })

  // The bug this test exists for: the slider used to be bound straight to the polled value, which
  // only refreshes every 30s. Each keypress recomputed from the same stale number and the thumb
  // snapped back, so twenty presses of an arrow key moved the limit by one.
  test('successive moves accumulate instead of snapping back to the last poll (#960)', () => {
    view = reading(20, 0)
    render(<Quota />)
    const slider = screen.getByLabelText('Unattended work stops at') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '5' } })
    expect(slider.value).toBe('5')
    fireEvent.change(slider, { target: { value: '12' } })
    expect(slider.value).toBe('12')
    expect(updatePreferences).toHaveBeenLastCalledWith({ autoSpendOffset: 12 })
  })

  test('the drawn limit follows the slider, not the poll (#960)', () => {
    view = reading(20, 0)
    const { container } = render(<Quota />)
    const marks = () => container.querySelectorAll('[role="img"] > div').length
    // Fill only: an unmoved limit sits on the boundary and is not drawn twice.
    expect(marks()).toBe(2)
    fireEvent.change(screen.getByLabelText('Unattended work stops at'), { target: { value: '20' } })
    // Fill, boundary, and now the limit — without waiting for the daemon to confirm it.
    expect(marks()).toBe(3)
  })
})


describe('the auto-PM readout (#1161)', () => {
  /** A sweep that considered one project, `minutesAgo` ago, with the next one an hour out. */
  function swept(message: string, started = false, minutesAgo = 2): AutoPmReport {
    return {
      enabled: true,
      sweptAt: Date.now() - minutesAgo * 60_000,
      nextSweepAt: Date.now() + 60 * 60_000,
      outcomes: [{ projectId: 'p1', path: '/Users/me/code/gemstack', started, message }],
    }
  }

  test('says why nothing is running, rather than leaving the toggle to be guessed at', () => {
    // The reason was always written — to the daemon's stdout, which the browser never shows.
    view = reading(20)
    autoPm = swept('4 runs are already going')
    render(<Quota />)
    expect(screen.getByText(/4 runs are already going/)).toBeTruthy()
    expect(screen.getByText(/gemstack/)).toBeTruthy()
  })

  test('names the project by its directory, not its whole path', () => {
    view = reading(20)
    autoPm = swept('the quota could not be read')
    render(<Quota />)
    expect(screen.queryByText(/Users\/me\/code/)).toBeNull()
  })

  test('says when it last looked and when it will look again', () => {
    view = reading(20)
    autoPm = swept('draining the first open queue entry', true)
    render(<Quota />)
    expect(screen.getByText(/Last checked 2m ago/)).toBeTruthy()
    expect(screen.getByText(/next in 1 hr/)).toBeTruthy()
  })

  test('stays quiet while the setting is off, since the box already says so', () => {
    view = reading(20)
    autoPm = { enabled: false, sweptAt: Date.now(), nextSweepAt: Date.now() + 60_000, outcomes: [] }
    render(<Quota />)
    expect(screen.queryByText(/Last checked/)).toBeNull()
  })

  test('a sweep that has not run yet reads as checking, never as an idle one', () => {
    view = reading(20)
    autoPm = { nextSweepAt: Date.now() + 60_000, outcomes: [] }
    render(<Quota />)
    expect(screen.getByText('Checking…')).toBeTruthy()
    expect(screen.queryByText(/No projects/)).toBeNull()
  })

  test('says nothing at all on a host that runs no sweep', () => {
    view = reading(20)
    autoPm = undefined
    render(<Quota />)
    expect(screen.queryByText(/Last checked/)).toBeNull()
    expect(screen.queryByText('Checking…')).toBeNull()
  })
})
