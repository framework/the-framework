import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { QuotaView } from '@gemstack/the-framework'

const updatePreferences = vi.hoisted(() => vi.fn())
vi.mock('../lib/preferences.js', () => ({ updatePreferences }))

let view: QuotaView | undefined
vi.mock('../lib/quota.js', () => ({ useQuota: () => view }))

const { Quota } = await import('./Quota.js')

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const STARTS_AT = new Date(2026, 6, 21, 19, 0, 0).getTime() // Tue evening, the mid-day-start case

/** A reading with a placeable week, so the bar has an axis to draw. */
function reading(percentUsed: number, limitOffset = 0): QuotaView {
  return readingAt(4, percentUsed, limitOffset) // day four of seven
}

/** Same, with the boundary at an arbitrary day — for the offset's clamp, which needs room to test. */
function readingAt(day: number, percentUsed: number, limitOffset = 0): QuotaView {
  const boundaryPercent = (day / 7) * 100
  return {
    windows: [
      { label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: 'Jul 28 at 7pm' },
      { label: 'Current session', kind: 'session', percentUsed: 3 },
    ],
    boundary: {
      boundary: { startsAt: STARTS_AT, resetsAt: STARTS_AT + WEEK_MS, day, percent: boundaryPercent },
      limit: { percent: Math.min(Math.max(boundaryPercent + limitOffset, 0), 100), offset: limitOffset },
      windows: [{ label: 'Current week (all models)', percentUsed, reached: false }],
      reached: null,
    },
  }
}

beforeEach(() => {
  view = undefined
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

  test('a week that began mid-day labels most of TU at the end of the bar, not the start (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    // The reset falls on a Tuesday too, a week later, and the 19h right before it are more of
    // Tuesday than the 5h sliver right after the week begins — so that is where the label goes,
    // and each day still reads exactly once.
    const labels = screen.getAllByText(/^[A-Z]{2}$/).map(el => el.textContent)
    expect(labels).toEqual(['WE', 'TH', 'FR', 'SA', 'SU', 'MO', 'TU'])
  })

  test('the session window is listed, but never as the bar', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.getByText('Current session')).toBeTruthy()
    // One bar, and it is the account's week.
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  test('the handle is valued on the bar\'s own scale, but stores an offset from the boundary (#960)', () => {
    view = reading(20)
    render(<Quota />)
    const slider = screen.getByLabelText('Unattended work stops at') as HTMLInputElement
    const boundaryPercent = (4 / 7) * 100
    // At rest it sits exactly on the boundary tick beneath it, not at some offset-scale zero.
    expect(Number(slider.value)).toBeCloseTo(boundaryPercent, 5)
    fireEvent.change(slider, { target: { value: String(boundaryPercent + 15) } })
    expect(updatePreferences).toHaveBeenCalledWith({ autoSpendOffset: 15 })
  })

  test('an unreadable quota explains itself instead of showing a zeroed bar', () => {
    view = { windows: [], unavailable: 'agent-not-found' }
    render(<Quota />)
    expect(screen.getByText(/Claude Code was not found/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    // And no slider: there is no line to move.
    expect(screen.queryByLabelText('Unattended work stops at')).toBeNull()
  })

  test('a week it cannot place is an error, not a quietly plainer panel', () => {
    // The failure this test exists for: Claude Code rephrased its reset times and the parser
    // missed, so the boundary vanished — and the panel just showed the week as a plain figure,
    // as if that were a design choice. No fallback: name the text that did not parse.
    view = {
      windows: [
        { label: 'Current week (all models)', kind: 'week', percentUsed: 45, resetsAtText: 'Jul 28, 9pm (Europe/Berlin)' },
        { label: 'Current session', kind: 'session', percentUsed: 3 },
      ],
      readAt: Date.now(),
    }
    render(<Quota />)
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn't parse quota/)
    expect(screen.getByRole('alert').textContent).toMatch(/Jul 28, 9pm \(Europe\/Berlin\)/)
    expect(screen.queryByRole('img')).toBeNull()
    // No plain week row standing in for the bar; the session line is data, not fallback, and stays.
    expect(screen.queryByText('Current week (all models)')).toBeNull()
    expect(screen.getByText('Current session')).toBeTruthy()
    expect(screen.queryByLabelText('Unattended work stops at')).toBeNull()
  })

  test('a readout it could not parse keeps the bar and dates it, rather than replacing it (#960)', () => {
    // The poller now survives an unrecognized answer, so the earlier reading is still on screen.
    // It has to say how old it is: an undated bar claims to be current.
    view = { ...reading(20), unavailable: 'unrecognized', readAt: Date.now() - 90 * 60 * 1000 }
    render(<Quota />)
    expect(screen.getByRole('img')).toBeTruthy()
    expect(screen.getByText(/from the reading before it/)).toBeTruthy()
    expect(screen.getByText(/Last read/)).toBeTruthy()
  })

  test('an unrecognized readout with nothing retained says it will try again (#960)', () => {
    view = { windows: [], unavailable: 'unrecognized' }
    render(<Quota />)
    // It used to read as terminal ("the boundary is off"), which is what made this look reverted.
    expect(screen.getByText(/Trying again shortly/)).toBeTruthy()
  })

  // The bug this test exists for: the slider used to be bound straight to the polled value, which
  // only refreshes every 30s. Each keypress recomputed from the same stale number and the thumb
  // snapped back, so twenty presses of an arrow key moved the limit by one.
  test('successive moves accumulate instead of snapping back to the last poll (#960)', () => {
    view = reading(20, 0)
    render(<Quota />)
    const slider = screen.getByLabelText('Unattended work stops at') as HTMLInputElement
    const boundaryPercent = (4 / 7) * 100
    fireEvent.change(slider, { target: { value: String(boundaryPercent + 5) } })
    expect(Number(slider.value)).toBeCloseTo(boundaryPercent + 5, 5)
    fireEvent.change(slider, { target: { value: String(boundaryPercent + 12) } })
    expect(Number(slider.value)).toBeCloseTo(boundaryPercent + 12, 5)
    expect(updatePreferences).toHaveBeenLastCalledWith({ autoSpendOffset: 12 })
  })

  test('the drawn limit follows the handle, not the poll (#960)', () => {
    view = reading(20, 0)
    render(<Quota />)
    const slider = screen.getByLabelText('Unattended work stops at') as HTMLInputElement
    const boundaryPercent = (4 / 7) * 100
    // At rest the handle sits exactly on the boundary tick — one mark, not two.
    expect(Number(slider.value)).toBeCloseTo(boundaryPercent, 5)
    fireEvent.change(slider, { target: { value: String(boundaryPercent + 20) } })
    // Moved, without waiting for the daemon to confirm it via the next poll.
    expect(Number(slider.value)).toBeCloseTo(boundaryPercent + 20, 5)
  })

  // The handle is valued 0-100, the same scale as the fill and boundary beneath it (#960 Edit) —
  // a native thumb's position is always (value - min) / (max - min) of the box, so min/max have to
  // stay 0/100 for the thumb to land where the boundary tick does. That leaves the ±50 the offset
  // is allowed to mean unenforced by the input itself, so the change handler has to clamp it.
  test('dragged to the far end of the bar, the stored offset still clamps to +50 (#960 Edit)', () => {
    // A boundary early in the week, so the bar's far (right) end is more than 50 points away.
    view = readingAt(1, 20, 0)
    render(<Quota />)
    fireEvent.change(screen.getByLabelText('Unattended work stops at'), { target: { value: '100' } })
    expect(updatePreferences).toHaveBeenLastCalledWith({ autoSpendOffset: 50 })
  })

  test('dragged to the near end of the bar, the stored offset still clamps to -50 (#960 Edit)', () => {
    // A boundary late in the week, so the bar's near (left) end is more than 50 points away.
    view = readingAt(6, 20, 0)
    render(<Quota />)
    fireEvent.change(screen.getByLabelText('Unattended work stops at'), { target: { value: '0' } })
    expect(updatePreferences).toHaveBeenLastCalledWith({ autoSpendOffset: -50 })
  })

  test('the bar splits into used and projected segments, not a used amount plus a floating mark (#960 Edit)', () => {
    view = reading(20, 15) // boundary 57%, offset 15 -> limit 72%
    render(<Quota />)
    const bar = screen.getByRole('img')
    const [used, projected] = bar.querySelectorAll<HTMLElement>(':scope > div')
    expect(used!.style.width).toBe('20%')
    expect(projected!.style.left).toBe('20%')
    expect(parseFloat(projected!.style.width)).toBeCloseTo(52.142857, 4) // 72% limit - 20% used
    expect(projected!.className).toMatch(/opacity-35/)
    // One bar, not two pills glued together: neither segment rounds its own corners — only the
    // track's own overflow-hidden shapes the ends.
    expect(used!.className).not.toMatch(/rounded/)
    expect(projected!.className).not.toMatch(/rounded/)
  })

  test('nothing left to project once the limit has already been reached, so no dimmed segment is drawn', () => {
    view = reading(80, -50) // boundary 57% - 50 = limit 7%, already well below the 80% used
    render(<Quota />)
    const bar = screen.getByRole('img')
    // Used, the day delimiters, and the boundary line — no dimmed segment, since there is no room.
    expect(bar.querySelectorAll('.opacity-35')).toHaveLength(0)
  })

  test('names whether autonomous AI currently has room to spend (#960 Edit)', () => {
    view = reading(20, 15) // limit 72% > 20% used: room left
    const { container } = render(<Quota />)
    expect(container.querySelector('em')?.textContent).toBe('enabled')
    expect(screen.getByText(/move slider to the left to disable/)).toBeTruthy()
  })

  test('names autonomous AI as disabled once the knob leaves no room (#960 Edit)', () => {
    view = reading(80, -50) // limit 7% < 80% used: no room
    const { container } = render(<Quota />)
    expect(container.querySelector('em')?.textContent).toBe('disabled')
    expect(screen.getByText(/move slider to the right to enable/)).toBeTruthy()
  })

  test('warns once the knob is dragged past today\'s boundary (#960 Edit)', () => {
    view = reading(20, 0) // limit sits exactly on the boundary: not past it yet
    render(<Quota />)
    expect(screen.queryByText(/Past today's boundary/)).toBeNull()
  })

  test('a positive offset always reads as past the boundary, since the limit only moves that way (#960 Edit)', () => {
    view = reading(20, 15) // limit 57% + 15 = 72%, past the 57% boundary
    render(<Quota />)
    expect(screen.getByText(/Past today's boundary/)).toBeTruthy()
  })

  test('one bar, not two: the handle is drawn on the week track itself (#960 Edit)', () => {
    view = reading(20, 0)
    const { container } = render(<Quota />)
    // A single native range input, and it lives inside the same card section as the week track —
    // not as a full-width slider of its own underneath it.
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1)
    const bar = screen.getByRole('img')
    const slider = screen.getByLabelText('Unattended work stops at')
    expect(bar.parentElement).toBe(slider.parentElement)
  })

  test('names the reset as a weekday and a time, not a date the bar already implies (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.getByText(/^resets /)).toBeTruthy()
    expect(screen.queryByText('Under the line, with room to spend.')).toBeNull()
  })

  test('the legend names the projected segment and gives the boundary a tooltip (#960 Edit)', () => {
    view = reading(20)
    const { container } = render(<Quota />)
    expect(screen.getByText('Autonomous AI usage (projected)')).toBeTruthy()
    expect(screen.getByText('Daily boundary')).toBeTruthy()
    expect(container.querySelector('svg.lucide-circle-help')).toBeTruthy()
  })

  test('the roadmap-spend toggle is gone from this panel (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.queryByText(/Spend what's left on the roadmap/)).toBeNull()
  })
})
