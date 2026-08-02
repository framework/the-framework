import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { startConsumptionGuard } from './consumption-guard.js'
import { FakeDriver } from './driver/index.js'
import type { Driver, DriverQuota, DriverQuotaWindow } from './driver/index.js'

/** 2026-07-20T12:00:00Z. The week below resets in 4 days 19 hours, so ~31.5% has elapsed (#960 Edit). */
const T0 = Date.UTC(2026, 6, 20, 12, 0, 0)

function quotaDriver(...readings: DriverQuota[]): Driver {
  let i = 0
  return {
    name: 'quota-fake',
    start: () => Promise.reject(new Error('not used')),
    readQuota: () => Promise.resolve(readings[Math.min(i++, readings.length - 1)] as DriverQuota),
  }
}

function week(percentUsed: number, ...extra: DriverQuotaWindow[]): DriverQuota {
  return {
    available: true,
    windows: [
      { label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: 'Jul 25 at 7am (UTC)' },
      ...extra,
    ],
  }
}

test('startConsumptionGuard leaves a driver that cannot report a quota ungated (#531)', () => {
  // The fake driver has no readQuota, so there is nothing to guard with. Fail
  // open: no reading must never mean "stop the work".
  assert.equal(startConsumptionGuard({ driver: new FakeDriver() }), undefined)
})

test('startConsumptionGuard gate says carry on before the first reading lands (#531)', () => {
  const guard = startConsumptionGuard({ driver: quotaDriver(week(5)), now: () => T0 })
  assert.ok(guard)
  // start() polls without awaiting, so there is nothing to measure yet.
  assert.equal(guard.gate(), null)
  guard.stop()
})

test('startConsumptionGuard gate pauses once the account is past the boundary (#879)', async () => {
  let at = T0
  const guard = startConsumptionGuard({ driver: quotaDriver(week(20), week(60)), now: () => at })
  assert.ok(guard)
  // start() takes the first reading itself; let it land.
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), null)
  at = T0 + 60_000
  await guard.poller.poll()
  assert.equal(guard.gate(), 'Current week (all models)')
  guard.stop()
})

test("startConsumptionGuard brings the run's own model window into the gate (#879)", async () => {
  const fable = { label: 'Current week (Fable)', kind: 'week-model' as const, percentUsed: 90 }
  const onFable = startConsumptionGuard({ driver: quotaDriver(week(10, fable)), model: 'claude-fable-5', now: () => T0 })
  assert.ok(onFable)
  await onFable.poller.poll()
  assert.equal(onFable.gate(), 'Current week (Fable)')
  onFable.stop()

  // A spent Fable week must not stop a run on another model.
  const onSonnet = startConsumptionGuard({ driver: quotaDriver(week(10, fable)), model: 'claude-sonnet-5', now: () => T0 })
  assert.ok(onSonnet)
  await onSonnet.poller.poll()
  assert.equal(onSonnet.gate(), null)
  onSonnet.stop()
})

test('startConsumptionGuard keeps a half-day cushion, so a fresh week is not paused over its first percent (#960 Edit)', async () => {
  // Half an hour into a fresh week the continuous boundary sits at ~0.3%, and the agent reports
  // whole percentages — without the cushion, "1% used" would pause the user's own first run.
  const halfHourIn = Date.UTC(2026, 6, 18, 7, 30, 0) // week runs Jul 18 7am -> Jul 25 7am (UTC)
  const guard = startConsumptionGuard({ driver: quotaDriver(week(1), week(9)), now: () => halfHourIn })
  assert.ok(guard)
  // start() takes the first reading itself; let it land.
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), null)
  // The cushion is half a day (~7.1 points), not a blank cheque: past it, the gate still bites.
  await guard.poller.poll()
  assert.equal(guard.gate(), 'Current week (all models)')
  guard.stop()
})

test('startConsumptionGuard honors the slider when it loosens the gate (#1490)', async () => {
  // T0 sits ~31.5% into the week; the default line is ~38.6%. A window at 45% pauses under the
  // default policy, but the user dragged the slider to boundary+20 (~51.5%) — the Usage bar
  // shows room, so the gate must agree.
  const guard = startConsumptionGuard({ driver: quotaDriver(week(45)), limitOffset: () => 20, now: () => T0 })
  assert.ok(guard)
  await guard.poller.poll()
  guard.gate() // first check kicks off the offset refresh…
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), null) // …and the next one sees it
  guard.stop()
})

test('startConsumptionGuard never lets the slider tighten the gate on work the user asked for (#1490)', async () => {
  // The slider pulled hard left (disabling unattended work) must not pause the user's own run:
  // a window just past the boundary but inside the default half-day cushion stays ungated.
  const guard = startConsumptionGuard({ driver: quotaDriver(week(35)), limitOffset: () => -50, now: () => T0 })
  assert.ok(guard)
  await guard.poller.poll()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), null)
  guard.stop()
})

test('startConsumptionGuard picks up a slider drag between checks, without a restart (#1490)', async () => {
  let offset = 0
  const guard = startConsumptionGuard({ driver: quotaDriver(week(45)), limitOffset: () => offset, now: () => T0 })
  assert.ok(guard)
  await guard.poller.poll()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), 'Current week (all models)') // 45% is past boundary+default
  offset = 20 // the user drags the handle right while the run is parked…
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(guard.gate(), null) // …and the next boundary check lets the run carry on
  guard.stop()
})

test('startConsumptionGuard gate carries on when the quota cannot be read (#531)', async () => {
  const guard = startConsumptionGuard({ driver: quotaDriver({ available: false, reason: 'fetch-failed' }), now: () => T0 })
  assert.ok(guard)
  await guard.poller.poll()
  assert.equal(guard.gate(), null)
  guard.stop()
})

test('startConsumptionGuard stop ends the polling (#531)', () => {
  const guard = startConsumptionGuard({ driver: quotaDriver(week(5)), now: () => T0 })
  assert.ok(guard)
  guard.stop()
  assert.equal(guard.poller.isStopped, true)
})

test('startConsumptionGuard reads the quota straight away rather than an interval later (#531)', async () => {
  let reads = 0
  const driver: Driver = {
    name: 'counting',
    start: () => Promise.reject(new Error('not used')),
    readQuota: () => {
      reads++
      return Promise.resolve(week(5))
    },
  }
  const guard = startConsumptionGuard({ driver, now: () => T0 })
  // A run that pauses on the boundary should find out early, not one poll
  // interval in.
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, 1)
  guard?.stop()
})
