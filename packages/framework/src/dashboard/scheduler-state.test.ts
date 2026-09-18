import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { SCHEDULER_STATE_FILE, collectSchedulers, loosestSpendOffset, readSchedulerState } from './scheduler-state.js'
import type { ProjectSummary } from './projects.js'

// The scheduler card's read (#1774): the state file as the tool writes it, and every way it can
// be absent or wrong, each read as "not set up" rather than an error.

const NOT_SET_UP = { present: false, on: false, keepAlive: false, running: false }

async function projectWith(state: string | undefined): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-scheduler-state-'))
  if (state !== undefined) {
    await mkdir(dirname(join(cwd, SCHEDULER_STATE_FILE)), { recursive: true })
    await writeFile(join(cwd, SCHEDULER_STATE_FILE), state)
  }
  return cwd
}

test('the state file as the scheduler writes it reads as the card shows it, with the process probed', async () => {
  const written = {
    on: true,
    keepAlive: false,
    model: 'opus',
    spendOffset: 7.142857142857143,
    lastTick: { at: '2026-09-16T17:45:55.452Z', decisions: [{ command: 'work-queue', outcome: 'started 2026-09-16T16-47-27-780Z', run: '2026-09-16T16-47-27-780Z' }] },
    pid: 16393,
    startedAt: '2026-09-16T16:43:51.892Z',
  }
  const cwd = await projectWith(JSON.stringify(written))
  try {
    const probed: number[] = []
    const alive = await readSchedulerState(cwd, pid => (probed.push(pid), true))
    assert.deepEqual(alive, {
      present: true,
      on: true,
      keepAlive: false,
      running: true,
      model: 'opus',
      spendOffset: 7.142857142857143,
      lastTick: { at: '2026-09-16T17:45:55.452Z', decisions: [{ command: 'work-queue', outcome: 'started 2026-09-16T16-47-27-780Z', run: '2026-09-16T16-47-27-780Z' }] },
    })
    assert.deepEqual(probed, [16393])
    // On with a dead process: the honest "on, not running" a crashed scheduler leaves.
    const dead = await readSchedulerState(cwd, () => false)
    assert.equal(dead.on, true)
    assert.equal(dead.running, false)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a tick that decided nothing carries its note; keep-alive and no pid read as they are', async () => {
  const cwd = await projectWith(JSON.stringify({ on: false, keepAlive: true, model: 'sonnet', lastTick: { at: '2026-09-16T17:00:00.000Z', decisions: [], note: 'off' } }))
  try {
    const state = await readSchedulerState(cwd, () => true)
    assert.deepEqual(state, { present: true, on: false, keepAlive: true, running: false, model: 'sonnet', lastTick: { at: '2026-09-16T17:00:00.000Z', decisions: [], note: 'off' } })
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('no file, a file that does not parse, a file of the wrong shape, and a tick of the wrong shape each read as not set up or without the tick', async () => {
  const missing = await projectWith(undefined)
  const broken = await projectWith('{not json')
  const list = await projectWith('[1, 2]')
  const oddTick = await projectWith(JSON.stringify({ on: true, lastTick: { decisions: 'none' } }))
  const oddDecision = await projectWith(JSON.stringify({ on: true, lastTick: { at: 't', decisions: [{ command: 'x' }, 3, { command: 'y', outcome: 'not due' }] } }))
  try {
    assert.deepEqual(await readSchedulerState(missing, () => true), NOT_SET_UP)
    assert.deepEqual(await readSchedulerState(broken, () => true), NOT_SET_UP)
    assert.deepEqual(await readSchedulerState(list, () => true), NOT_SET_UP)
    assert.deepEqual(await readSchedulerState(oddTick, () => true), { present: true, on: true, keepAlive: false, running: false })
    assert.deepEqual((await readSchedulerState(oddDecision, () => true)).lastTick, { at: 't', decisions: [{ command: 'y', outcome: 'not due' }] })
  } finally {
    for (const cwd of [missing, broken, list, oddTick, oddDecision]) await rm(cwd, { recursive: true, force: true })
  }
})

test('collectSchedulers gives one row per registered project, in registry order, a failing read as not set up', async () => {
  const project = (id: string): ProjectSummary => ({ id, path: `/${id}`, name: id, activated: true })
  const rows = await collectSchedulers([project('a'), project('b'), project('c')], async cwd => {
    if (cwd === '/b') throw new Error('unreadable')
    return { present: true, on: cwd === '/a', keepAlive: false, running: cwd === '/a', model: 'opus' }
  })
  assert.deepEqual(rows, [
    { projectId: 'a', projectName: 'a', present: true, on: true, keepAlive: false, running: true, model: 'opus' },
    { projectId: 'b', projectName: 'b', ...NOT_SET_UP },
    { projectId: 'c', projectName: 'c', present: true, on: false, keepAlive: false, running: false, model: 'opus' },
  ])
})

test('the usage panel draws the loosest spend offset the schedulers hold; none named is none', () => {
  const state = (spendOffset?: number) => ({ ...NOT_SET_UP, present: true, ...(spendOffset !== undefined ? { spendOffset } : {}) })
  assert.equal(loosestSpendOffset([state(-5), state(12), state()]), 12)
  assert.equal(loosestSpendOffset([state(-5)]), -5)
  assert.equal(loosestSpendOffset([state(), NOT_SET_UP]), undefined)
  assert.equal(loosestSpendOffset([]), undefined)
})
