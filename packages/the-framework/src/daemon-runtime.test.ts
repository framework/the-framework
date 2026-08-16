import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { waitOutFinishedLeg, waitOutSlots, type FinishedLegState } from './daemon-runtime.js'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const emptySlots = (): { starting: Set<string>; activeAgents: Map<string, number>; retiring: Map<string, Promise<void>> } => ({
  starting: new Set<string>(),
  activeAgents: new Map<string, number>(),
  retiring: new Map<string, Promise<void>>(),
})

// The seam behind #1529: a Resume fired the instant a run flips `done` used to reach the busy
// guard while the child that wrote that ending was still mid-exit, and the guard refused a
// session that was over by its own account. These pin the wait's decision table; the settings
// story exercises the full daemon path.

test('a free slot returns immediately, without even asking whether the leg ended', async () => {
  let asked = 0
  await waitOutFinishedLeg(
    'p::r1',
    emptySlots(),
    async () => {
      asked += 1
      return 'ended'
    },
    5_000,
  )
  assert.equal(asked, 0)
})

test('a leg still calling itself running is a real collision: no wait, the refusal stands', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  const before = Date.now()
  await waitOutFinishedLeg('p::r1', slots, async () => 'running', 5_000)
  assert.ok(Date.now() - before < 1_000, 'must not sit out the grace period')
  assert.ok(slots.activeAgents.has('p::r1'), 'the slot is left for the busy guard to judge')
})

test('a finished leg is waited out: the wait ends once the exit clears the slot', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  setTimeout(() => slots.activeAgents.delete('p::r1'), 60)
  await waitOutFinishedLeg('p::r1', slots, async () => 'ended', 5_000)
  assert.equal(slots.activeAgents.has('p::r1'), false)
})

test('the wait is bounded: a finished leg whose process never exits falls back to the guard', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  const before = Date.now()
  await waitOutFinishedLeg('p::r1', slots, async () => 'ended', 120)
  assert.ok(Date.now() - before >= 120, 'the grace period was sat out')
  assert.ok(slots.activeAgents.has('p::r1'), 'the still-occupied slot reaches the busy guard')
})

test('a retirement already in flight is awaited even after the exit cleared the slot', async () => {
  const slots = emptySlots()
  let retired = false
  slots.retiring.set(
    'p::r1',
    sleep(60).then(() => {
      retired = true
    }),
  )
  await waitOutFinishedLeg('p::r1', slots, async () => 'ended', 5_000)
  assert.equal(retired, true)
})

test('a retirement that failed does not fail the continuation waiting on it', async () => {
  const slots = emptySlots()
  slots.retiring.set('p::r1', Promise.reject(new Error('archive on a full disk')))
  await waitOutFinishedLeg('p::r1', slots, async () => 'ended', 5_000)
})

// #1540: the state is read off a `agent.json` the leg's own process rewrites in place, so a read
// that lands inside one of those writes has no answer. Sampled once and taken for "still
// running", that lone unreadable moment skipped the wait and handed the continuation to the busy
// guard while the leg was mid-exit — #1529's spurious refusal, back as a rarer race.

test('an unreadable leg is asked again rather than taken for a live one', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  setTimeout(() => slots.activeAgents.delete('p::r1'), 90)
  let asked = 0
  await waitOutFinishedLeg(
    'p::r1',
    slots,
    async () => {
      asked += 1
      return 'unknown'
    },
    5_000,
  )
  assert.equal(slots.activeAgents.has('p::r1'), false, 'the exit was waited out, not refused')
  assert.ok(asked > 1, `the unreadable meta was re-read (asked ${asked} times)`)
})

test('an unreadable leg that then reports running still short-circuits to the guard', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  const states: FinishedLegState[] = ['unknown', 'unknown', 'running']
  const before = Date.now()
  await waitOutFinishedLeg('p::r1', slots, async () => states.shift() ?? 'running', 5_000)
  assert.ok(Date.now() - before < 1_000, 'must not sit out the grace period')
  assert.equal(states.length, 0, 'it kept asking until the leg committed')
  assert.ok(slots.activeAgents.has('p::r1'), 'the slot is left for the busy guard to judge')
})

test('an ended leg is not re-read: the state is settled after the first answer', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  setTimeout(() => slots.activeAgents.delete('p::r1'), 90)
  let asked = 0
  await waitOutFinishedLeg(
    'p::r1',
    slots,
    async () => {
      asked += 1
      return 'ended'
    },
    5_000,
  )
  assert.equal(asked, 1)
})

// The seam behind shutdown's ordering: killing a pid is not letting go of the repo. The child's
// `exit` event lands after the process is gone, and the teardown that event starts runs well past
// that — so a shutdown that waits only on the processes commits archives that are still being
// written, and anything cleaning up behind the daemon races its git.

test('slots nothing has touched return at once: there is nothing to wait for', async () => {
  const before = Date.now()
  await waitOutSlots(['p::r1', 'p::r2'], emptySlots(), 5_000)
  assert.ok(Date.now() - before < 1_000, 'no grace period was sat out')
})

test('a slot whose exit has not landed yet is waited for, not read as already settled', async () => {
  // The gap this exists to close: the pid is gone, so the slot looks free, but `settle` has yet to
  // run and the teardown it parks has not even been created.
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  let torn = false
  setTimeout(() => {
    // What `settle` does: drop the live slot, park the teardown it starts in its place.
    slots.activeAgents.delete('p::r1')
    slots.retiring.set(
      'p::r1',
      sleep(60).then(() => {
        torn = true
        slots.retiring.delete('p::r1')
      }),
    )
  }, 40)
  await waitOutSlots(['p::r1'], slots, 5_000)
  assert.equal(torn, true, 'the teardown that appeared mid-wait was waited out too')
})

test('a run with no worktree needs no special case: it parks no teardown and holds nothing up', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  setTimeout(() => slots.activeAgents.delete('p::r1'), 40)
  await waitOutSlots(['p::r1'], slots, 5_000)
  assert.equal(slots.retiring.size, 0)
})

test('a teardown that throws does not fail the shutdown waiting on it', async () => {
  const slots = emptySlots()
  slots.retiring.set('p::r1', Promise.reject(new Error('archive on a full disk')))
  setTimeout(() => slots.retiring.delete('p::r1'), 40)
  await waitOutSlots(['p::r1'], slots, 5_000)
})

test('the wait is bounded: a wedged teardown costs the grace period, not the exit', async () => {
  const slots = emptySlots()
  slots.activeAgents.set('p::r1', process.pid)
  const before = Date.now()
  await waitOutSlots(['p::r1'], slots, 120)
  assert.ok(Date.now() - before >= 120, 'the grace period was sat out')
  assert.ok(slots.activeAgents.has('p::r1'), 'and it gave up rather than hanging the shutdown')
})
