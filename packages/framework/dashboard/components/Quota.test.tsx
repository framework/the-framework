import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { QuotaView } from '../../src/index.js'

/** Opens a Base UI tooltip in a test: hover alone leaves the popup unrendered until this settles. */
async function openTooltip(trigger: HTMLElement) {
  fireEvent.mouseEnter(trigger)
  fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
  await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy())
}

/** The main figure's own trigger — its text is split across nodes (a coloured span for the
 * duration), so an exact string match on `getByText` can't find it as one element. */
function mainFigureTrigger(): HTMLElement {
  return screen.getByText(/^resets /).closest('p')!.querySelector('.cursor-default')!
}

let view: QuotaView | undefined
vi.mock('../lib/quota.js', () => ({ useQuota: () => view }))

const { Quota } = await import('./Quota.js')

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const STARTS_AT = new Date(2026, 6, 21, 19, 0, 0).getTime() // Tue evening, the mid-day-start case

/** A reading with a placeable week, so the bar has an axis to draw: day four of seven. */
function reading(percentUsed: number): QuotaView {
  return readingAt(4, percentUsed)
}

/** Same, with the boundary at an arbitrary day. */
function readingAt(day: number, percentUsed: number): QuotaView {
  return {
    windows: [
      { label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: 'Jul 28 at 7pm' },
      { label: 'Current session', kind: 'session', percentUsed: 3 },
    ],
    boundary: { startsAt: STARTS_AT, resetsAt: STARTS_AT + WEEK_MS, day, percent: (day / 7) * 100 },
  }
}

beforeEach(() => {
  view = undefined
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

  test('draws one day label per calendar day, and a separator between each (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    // STARTS_AT is a Tuesday evening: the fixture's mid-day-start case, so `TU` reads once, at
    // whichever end of the bar most of Tuesday actually falls (the end, here).
    const labels = screen.getAllByText(/^[A-Z]{2}$/).map(el => el.textContent)
    expect(labels).toEqual(['WE', 'TH', 'FR', 'SA', 'SU', 'MO', 'TU'])
    // One separator less than the number of calendar days the week touches (no separator before
    // the very first day), plus the used fill and the boundary line.
    expect(screen.getByRole('img').querySelectorAll(':scope > div')).toHaveLength(9)
  })

  test('the session window is reachable through the bar\'s "show all limits" tooltip, never as its own bar', async () => {
    view = reading(20)
    render(<Quota />)
    // One bar, and it is the account's week.
    expect(screen.getAllByRole('img')).toHaveLength(1)
    await openTooltip(screen.getByText('show all limits'))
    expect(screen.getByText('Current session')).toBeTruthy()
  })

  test('an unreadable quota explains itself instead of showing a zeroed bar', () => {
    view = { windows: [], unavailable: 'agent-not-found' }
    render(<Quota />)
    expect(screen.getByText(/Claude Code was not found/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    // And no slider: there is no line to move.
    expect(screen.queryByLabelText('Unattended work stops at')).toBeNull()
  })

  test('a week with no reset time says so, rather than denying the week exists', () => {
    // The third way to be unplaceable, and the one an untouched account hits: nothing consumed, so
    // Claude Code prints the window without its `· resets …` tail. `quotaBoundaryStatus` yields no
    // boundary without that text, and the panel used to borrow the "no week" wording — while the
    // list right below the alert showed the very week it claimed not to have.
    view = {
      windows: [
        { label: 'Current week (all models)', kind: 'week', percentUsed: 0 },
        { label: 'Current session', kind: 'session', percentUsed: 0 },
      ],
      readAt: Date.now(),
    }
    render(<Quota />)
    const alert = screen.getByRole('alert').textContent ?? ''
    expect(alert).toMatch(/no reset time/)
    expect(alert).toMatch(/Current week \(all models\)/)
    expect(alert).not.toMatch(/no “Current week \(all models\)” line/) // it has one; that is the point
    expect(screen.queryByRole('img')).toBeNull()
  })

  test('a readout with no week at all names the missing line and what came instead (#1367 follow-up)', () => {
    // The readout is prose from another program, so when the week is simply absent the labels that
    // *did* arrive are the whole diagnosis — this used to say only "no week this version can
    // place", which nobody can act on or paste into an issue.
    view = {
      windows: [
        { label: 'Current session', kind: 'session', percentUsed: 3 },
        { label: 'Current week (Fable)', kind: 'week-model', percentUsed: 15 },
      ],
      readAt: Date.now(),
    }
    render(<Quota />)
    const alert = screen.getByRole('alert').textContent ?? ''
    expect(alert).toMatch(/Couldn't parse quota/)
    expect(alert).toMatch(/Current week \(all models\)/) // the line the parser wanted
    expect(alert).toMatch(/“Current session”/) // and the ones it got
    expect(alert).toMatch(/“Current week \(Fable\)”/)
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
    // The alert stands on its own rather than being quietly swapped for a plain figure — but the
    // windows Claude Code did report are still data, not a fallback, and still list.
    expect(screen.getByText('Current session')).toBeTruthy()
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

  test('names the reset as a weekday and a time, not a date the bar already implies (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.getByText(/^resets /)).toBeTruthy()
    expect(screen.queryByText('Under the line, with room to spend.')).toBeNull()
  })

  test('the main figure reads a pace deviation as a duration, not a percentage of the week (#960 Edit)', () => {
    // 20% of the week used against a 57% (day 4/7) pace: 2.6 days behind, floored to 2d.
    view = reading(20)
    render(<Quota />)
    expect(mainFigureTrigger().textContent).toBe('Under-consuming: 2d')
    expect(screen.queryByText('20% used')).toBeNull()
    expect(screen.queryByText(/^-?\d+% used$/)).toBeNull()
  })

  test('the duration is bold and coloured to match the bar\'s own tone, the label plain (#960 Edit)', () => {
    view = reading(20) // under-consuming: the bar's tone (and so the duration) reads green
    render(<Quota />)
    const trigger = mainFigureTrigger()
    expect(trigger.className).not.toMatch(/font-medium/)
    const duration = trigger.querySelector('span')!
    expect(duration.textContent).toBe('2d')
    expect(duration.className).toMatch(/font-medium/)
    expect(duration.className).toMatch(/text-success/)
  })

  test('reads over-consuming (zero duration) exactly on the boundary\'s own pace', () => {
    view = reading((4 / 7) * 100)
    render(<Quota />)
    expect(mainFigureTrigger().textContent).toBe('Over-consuming: 0s')
  })

  test('reads over-consuming with a duration when ahead of pace', () => {
    // Boundary at day 1 of 7 (~14.3%), 60% used: well over three sevenths of the week ahead.
    view = readingAt(1, 60)
    render(<Quota />)
    expect(mainFigureTrigger().textContent).toMatch(/^Over-consuming: \d+d$/)
  })

  test('the footer also says what was spent, as quota time (#1367)', () => {
    // Half the week used is half the week's allowance consumed — the same unit as the pace figure
    // beside it, rather than a percentage a reader has to convert.
    view = reading(50)
    render(<Quota />)
    expect(screen.getByText(/^resets /).closest('p')!.textContent).toMatch(/3d spent/)
  })

  test('the footer says consumption as a share of the pace, not of the week (#1367)', () => {
    // Boundary at day 4 of 7 (~57%), 60% used: a little over pace, so a little over 100%.
    view = reading(60)
    render(<Quota />)
    expect(screen.getByText(/^resets /).closest('p')!.textContent).toMatch(/105% of pace/)
  })

  test('the pace share is coloured to match the bar, since it is the same comparison (#1367)', () => {
    view = reading(20) // well under pace: the bar reads green, and so does this
    render(<Quota />)
    const share = [...screen.getByText(/^resets /).closest('p')!.querySelectorAll('span')].find(s =>
      /^\d+%$/.test(s.textContent ?? ''),
    )!
    expect(share.className).toMatch(/text-success/)
  })

  test('no pace share at the very start of the week, rather than an infinite one (#1367)', () => {
    // Day zero: nothing is allowed yet, so every amount is infinitely above the allowance.
    view = readingAt(0, 3)
    render(<Quota />)
    expect(screen.getByText(/^resets /).closest('p')!.textContent).not.toMatch(/of pace/)
  })

  test('the main figure has its own tooltip naming the deviation against the quota boundary (#960 Edit)', async () => {
    view = reading(20)
    render(<Quota />)
    await openTooltip(mainFigureTrigger())
    expect(screen.getByText(/You are 2 days below the quota boundary\.\s*You're under-consuming: you spend slower/)).toBeTruthy()
  })

  test('the legend names the used fill and gives the quota boundary a tooltip (#960 Edit)', () => {
    view = reading(20)
    const { container } = render(<Quota />)
    expect(screen.getByText('Used')).toBeTruthy()
    expect(screen.getByText('Quota boundary')).toBeTruthy()
    expect(container.querySelector('svg.lucide-circle-help')).toBeTruthy()
  })

  test('the quota boundary tooltip explains itself in its own paragraph, and ends on a fun fact (#960 Edit)', async () => {
    view = reading(20)
    render(<Quota />)
    await openTooltip(screen.getByText('Quota boundary'))
    expect(
      screen.getByText("If your usage matches the quota boundary, then you're spending exactly what the week's pace allows."),
    ).toBeTruthy()
    expect(
      screen.getByText('Fun fact: the quota boundary is shown exactly at the current time in the week usage bar above.'),
    ).toBeTruthy()
  })

  test('the reset tooltip trigger carries no underline (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    const trigger = screen.getByText(/^resets /)
    expect(trigger.className).not.toMatch(/underline/)
  })

  test('every window Claude Code reports gets its own line, reachable through "show all limits" (#960 Edit)', async () => {
    view = reading(20)
    view.windows.push({ label: 'Current week (Fable)', kind: 'week-model', percentUsed: 12, resetsAtText: 'Jul 28 at 7pm' })
    render(<Quota />)
    await openTooltip(screen.getByText('show all limits'))
    const rows = screen.getAllByText(/Current (session|week)/).map(el => el.textContent)
    expect(rows).toEqual(['Current week (all models)', 'Current session', 'Current week (Fable)'])
  })

  test('"show all limits" renders as a real table, not flex rows that drift out of alignment (#960 Edit)', async () => {
    view = reading(20)
    view.windows.push({ label: 'Current week (Fable)', kind: 'week-model', percentUsed: 12, resetsAtText: 'Jul 28 at 7pm' })
    render(<Quota />)
    await openTooltip(screen.getByText('show all limits'))
    const tooltip = screen.getByRole('tooltip')
    const table = tooltip.querySelector('table')!
    expect(table).toBeTruthy()
    expect(table.querySelectorAll('tr')).toHaveLength(3)
    for (const row of table.querySelectorAll('tr')) expect(row.querySelectorAll('td')).toHaveLength(2)
  })

  test('"show all limits" is absent when there is nothing else to show', () => {
    view = { ...reading(20), windows: reading(20).windows.filter(w => w.kind === 'week') }
    render(<Quota />)
    expect(screen.queryByText('show all limits')).toBeNull()
  })

  test('the roadmap-spend toggle is gone from this panel (#960 Edit)', () => {
    view = reading(20)
    render(<Quota />)
    expect(screen.queryByText(/Spend what's left on the roadmap/)).toBeNull()
  })
})
