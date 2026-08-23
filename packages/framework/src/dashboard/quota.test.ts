import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { pollerQuotaSource } from './quota.js'
import { QuotaPoller } from '../quota-poller.js'
import { DEFAULT_SPEND_OFFSET } from '../preference-defaults.js'
import type { DriverQuota } from '../driver/index.js'

/** 2026-07-20T12:00:00Z. The week below resets in 5 days, so this is day 3 of 7. */
const T0 = Date.UTC(2026, 6, 20, 12, 0, 0)
const HOUR = 60 * 60 * 1000

function week(percentUsed: number): DriverQuota {
  return {
    available: true,
    windows: [
      { label: 'Current session', kind: 'session', percentUsed: 2, resetsAtText: 'in 2h 53m' },
      { label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: 'Jul 25 at 7am (UTC)' },
    ],
  }
}

function sourceOf(script: DriverQuota[]) {
  let at = T0
  let i = 0
  const poller = new QuotaPoller({ read: () => Promise.resolve(script[Math.min(i++, script.length - 1)] as DriverQuota), now: () => at })
  return { source: pollerQuotaSource(poller, () => at), poller, advance: (ms: number) => (at += ms) }
}

test('the usage panel gets the account windows and where the boundary stands (#533/#879)', async () => {
  const { source, poller, advance } = sourceOf([week(10), week(16)])
  await poller.poll()
  advance(HOUR)
  await poller.poll()
  const view = await source.read()
  // The account's own bars, as Traycer shows them.
  assert.equal(view.windows.length, 2)
  assert.equal(view.windows.find(w => w.kind === 'week')?.percentUsed, 16)
  assert.equal(view.readAt, T0 + HOUR)
  assert.equal(view.unavailable, undefined)
  // And the boundary: day 3 of the week allows three sevenths of it, and 16% is under that.
  assert.equal(view.boundary?.boundary.day, 3)
  assert.equal(view.boundary?.reached, null)
})

test('the boundary moves with the clock rather than with the reading (#879)', async () => {
  const { source, poller, advance } = sourceOf([week(50)])
  await poller.poll()
  assert.equal((await source.read()).boundary?.reached?.label, 'Current week (all models)')
  // Two days later the same 50% is under the line, with no new reading.
  advance(2 * 24 * HOUR)
  const later = await source.read()
  assert.equal(later.boundary?.boundary.day, 5)
  assert.equal(later.boundary?.reached, null)
})

test('the usage panel keeps the last reading and marks it stale on a blip (#533)', async () => {
  const { source, poller, advance } = sourceOf([week(10), { available: false, reason: 'fetch-failed' }])
  await poller.poll()
  advance(1000)
  await poller.poll()
  const view = await source.read()
  // The number is a second old; blanking it would read as "nothing used".
  assert.equal(view.windows.find(w => w.kind === 'week')?.percentUsed, 10)
  assert.equal(view.readAt, T0)
  assert.equal(view.unavailable, 'fetch-failed')
})

test('the usage panel reports no reading rather than an empty one (#533)', async () => {
  const { source } = sourceOf([{ available: false, reason: 'no-subscription' }])
  const view = await source.read()
  assert.deepEqual(view.windows, [])
  // Absent, not a boundary of zero: we cannot read the account at all.
  assert.equal(view.boundary, undefined)
})

test('an unplaceable week leaves the boundary absent rather than guessed (#879)', async () => {
  const { source, poller } = sourceOf([
    { available: true, windows: [{ label: 'Current week (all models)', kind: 'week', percentUsed: 10 }] },
  ])
  await poller.poll()
  const view = await source.read()
  assert.equal(view.windows.length, 1)
  assert.equal(view.boundary, undefined)
})

test('stopping the source ends the polling (#533)', () => {
  const { source, poller } = sourceOf([week(10)])
  source.stop()
  assert.equal(poller.isStopped, true)
})

test('with no slider position given, the limit defaults to a half-day cushion above the boundary (#960 Edit)', async () => {
  const { source, poller } = sourceOf([week(10)])
  await poller.poll()
  const view = await source.read()
  assert.equal(view.boundary?.limit.offset, DEFAULT_SPEND_OFFSET)
  assert.equal(view.boundary?.limit.percent, view.boundary!.boundary.percent + DEFAULT_SPEND_OFFSET)
})

/**
 * The account with room to spare on the week overall, and one model's own week spent (#1619).
 *
 * The live shape this came from, with the account's number moved under the line: on day 3 of 7 the
 * week's own 54% was already past its limit, which would have hidden the very thing under test.
 */
function spentModelWeek(): DriverQuota {
  return {
    available: true,
    windows: [
      { label: 'Current session', kind: 'session', percentUsed: 4, resetsAtText: 'in 2h 53m' },
      { label: 'Current week (all models)', kind: 'week', percentUsed: 30, resetsAtText: 'Jul 25 at 7am (UTC)' },
      { label: 'Current week (Fable)', kind: 'week-model', percentUsed: 100, resetsAtText: 'Jul 25 at 7am (UTC)' },
    ],
  }
}

test('the panel stays about the account: a spent model week is not the bar the user reads (#533/#879)', async () => {
  const { source, poller } = sourceOf([spentModelWeek()])
  await poller.poll()
  const view = await source.read()
  // All three windows are shown — the panel draws what the account reported.
  assert.equal(view.windows.length, 3)
  // But only the account's own week is measured, so a model nobody named cannot make the bar
  // say the account is out of allowance when the week itself is only 30% spent.
  assert.deepEqual(view.boundary?.windows.map(w => w.label), ['Current week (all models)'])
  assert.equal(view.boundary?.reached, null)
})

test("naming the model the work will run on brings that model's own week into the gate (#1619)", async () => {
  const { source, poller } = sourceOf([spentModelWeek()])
  await poller.poll()
  // The question a start asks, as against the question the panel asks: same reading, same slider,
  // one more window in force — the one the work would actually spend.
  const boundary = await source.boundaryFor('claude-fable-5')
  assert.deepEqual(boundary?.windows.map(w => w.label), ['Current week (all models)', 'Current week (Fable)'])
  assert.equal(boundary?.reached?.label, 'Current week (Fable)')
  // And the account-wide answer is still the account-wide answer: this is a second question, not
  // a replacement for the first.
  assert.equal((await source.read()).boundary?.reached, null)
})

test('a model whose week the account never reported is gated on the account alone (#1619)', async () => {
  const { source, poller } = sourceOf([spentModelWeek()])
  await poller.poll()
  // Opus has no window here, so there is nothing of its own to measure and the spent Fable week
  // is none of its business: a window we cannot tie to the model must not stop work (#879).
  const boundary = await source.boundaryFor('claude-opus-5')
  assert.deepEqual(boundary?.windows.map(w => w.label), ['Current week (all models)'])
  assert.equal(boundary?.reached, null)
  // No model at all is the same answer as the panel's.
  assert.deepEqual((await source.boundaryFor())?.windows, (await source.read()).boundary?.windows)
})
