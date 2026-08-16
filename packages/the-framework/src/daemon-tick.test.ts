import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { startDaemonTick, type TickJob } from './daemon-tick.js'

// E4: one clock, and each job says how many ticks it wants between turns. The tests drive `tick()`
// rather than the interval, which is the point of the tick being awaitable.

/** A clock whose interval never fires in the test's lifetime, driven by hand. */
function clock(jobs: readonly TickJob[]) {
  const logs: string[] = []
  const tick = startDaemonTick({ jobs, intervalMs: 60 * 60_000, log: line => logs.push(line) })
  return { tick, logs }
}

test('a job runs every Nth tick, and its own turn is skipped rather than queued', async () => {
  const ran: string[] = []
  const { tick } = clock([
    { name: 'fast', run: async () => void ran.push('fast') },
    { name: 'slow', every: 3, run: async () => void ran.push('slow') },
  ])
  try {
    // The constructor fires tick 0, which both jobs take.
    await tick.tick()
    for (let i = 0; i < 3; i++) await tick.tick()
    // Ticks 0,1,2,3 for `fast`; ticks 0 and 3 for `slow`.
    assert.deepEqual(ran, ['fast', 'slow', 'fast', 'fast', 'fast', 'slow'])
  } finally {
    tick.stop()
  }
})

test('a job can sit out the start-up tick, which every other job takes', async () => {
  // The first tick fires at start-up rather than an interval later, because the case most of these
  // jobs exist for is a machine that was off while something happened.
  const ran: string[] = []
  const { tick } = clock([
    { name: 'seeds', run: async () => void ran.push('seeds') },
    { name: 'waits', onStart: false, run: async () => void ran.push('waits') },
  ])
  try {
    await tick.tick()
    assert.deepEqual(ran, ['seeds'])
    await tick.tick()
    assert.deepEqual(ran, ['seeds', 'seeds', 'waits'])
  } finally {
    tick.stop()
  }
})

test('a job that throws costs its own turn and nothing else, and is named in the log', async () => {
  // A sweep failing silently is indistinguishable from one that was never scheduled at all.
  const ran: string[] = []
  const { tick, logs } = clock([
    {
      name: 'CI watch',
      run: async () => {
        throw new Error('gh is down')
      },
    },
    { name: 'after', run: async () => void ran.push('after') },
  ])
  try {
    await tick.tick()
    assert.deepEqual(ran, ['after'], 'the rest of the tick still ran')
    assert.equal(logs.length, 1)
    assert.match(logs[0]!, /CI watch failed this tick: gh is down/)
  } finally {
    tick.stop()
  }
})

test('jobs run in order, one at a time: a slow one holds the tick rather than overlapping it', async () => {
  const order: string[] = []
  const { tick } = clock([
    {
      name: 'slow',
      run: async () => {
        order.push('slow:start')
        await new Promise(resolve => setTimeout(resolve, 5))
        order.push('slow:end')
      },
    },
    { name: 'next', run: async () => void order.push('next') },
  ])
  try {
    await tick.tick()
    assert.deepEqual(order, ['slow:start', 'slow:end', 'next'])
  } finally {
    tick.stop()
  }
})

test('an overlapping tick joins the one already running, so awaiting it means it finished', async () => {
  let running = 0
  let peak = 0
  const { tick } = clock([
    {
      name: 'job',
      run: async () => {
        peak = Math.max(peak, ++running)
        await new Promise(resolve => setTimeout(resolve, 5))
        running--
      },
    },
  ])
  try {
    await Promise.all([tick.tick(), tick.tick(), tick.tick()])
    assert.equal(peak, 1, 'never two turns of the same job at once')
    assert.equal(running, 0, 'and awaiting the tick means it finished')
  } finally {
    tick.stop()
  }
})

test('a stopped clock runs nothing further', async () => {
  let ran = 0
  const { tick } = clock([{ name: 'job', run: async () => void ran++ }])
  await tick.tick()
  tick.stop()
  await tick.tick()
  assert.equal(ran, 1)
})
