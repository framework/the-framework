import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@openagt/agent-data'
import { DEFAULT_STATE, readState, statePath, updateState, writeState, type State, isSwitchedOn, withSwitch, publishInForce, withPace, withPublish } from './state.js'
import { STATE_DIR } from './names.js'

const git = nodeGitRunner()

async function repo(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'scheduler-state-')))
  await git(['init', '-q', '-b', 'main'], path)
  return path
}

test('no state file reads as the default: off, no keep-alive, opus, the half-day cushion', async () => {
  const root = await repo()
  try {
    assert.deepEqual(await readState(root), DEFAULT_STATE)
    assert.equal(DEFAULT_STATE.on, false)
    assert.equal(DEFAULT_STATE.model, 'opus')
    assert.ok(Math.abs(DEFAULT_STATE.spendOffset - 100 / 14) < 1e-9)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the first write hides the directory from git through the exclude file; a read gives back what was written, defaults filled', async () => {
  const root = await repo()
  try {
    await writeState(root, { ...DEFAULT_STATE, on: true, pid: 4242 })
    assert.match(await readFile(join(root, '.git', 'info', 'exclude'), 'utf8'), new RegExp(`^/${STATE_DIR}$`, 'm'))
    assert.equal((await git(['status', '--porcelain'], root)).trim(), '', 'nothing of the state shows in the project')
    await writeFile(statePath(root), '{"on": true}')
    assert.deepEqual(await readState(root), { ...DEFAULT_STATE, on: true })
    const next = await updateState(root, s => ({ ...s, model: 'sonnet' }))
    assert.equal(next.model, 'sonnet')
    assert.equal((await readState(root)).model, 'sonnet')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a state file that does not parse reads as the default rather than stopping the tick', async () => {
  const root = await repo()
  try {
    await writeState(root, DEFAULT_STATE)
    await writeFile(statePath(root), '{not json')
    assert.deepEqual(await readState(root), DEFAULT_STATE)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('every command starts switched off; only a command switched on is kept, so switching it off leaves no trace', () => {
  assert.equal(isSwitchedOn(DEFAULT_STATE, 'work-queue'), false)
  const on = withSwitch(DEFAULT_STATE, 'post-merge-cleanup', true)
  assert.deepEqual(on.switches, { 'post-merge-cleanup': true })
  assert.equal(isSwitchedOn(on, 'post-merge-cleanup'), true)
  assert.equal(isSwitchedOn(on, 'work-queue'), false)
  // Switching off a command nobody switched on keeps nothing of it.
  const both = withSwitch(withSwitch(on, 'triage quick', true), 'work-queue', false)
  assert.deepEqual(both.switches, { 'post-merge-cleanup': true, 'triage quick': true })
  const back = withSwitch(withSwitch(both, 'triage quick', false), 'post-merge-cleanup', false)
  assert.equal('switches' in back, false)
  // A state edited by hand: anything but true is off.
  assert.equal(isSwitchedOn({ ...DEFAULT_STATE, switches: { 'work-queue': 'on' as never } }, 'work-queue'), false)
})

test('a scheduler ending clears its own pid only: a pid another scheduler wrote meanwhile stays', async () => {
  const { withoutPid } = await import('./state.js')
  const mine: State = { ...DEFAULT_STATE, on: true, pid: 100, startedAt: '2026-01-01T00:00:00.000Z' }
  assert.deepEqual(withoutPid(mine, 100), { ...DEFAULT_STATE, on: true })
  const theirs: State = { ...mine, pid: 200 }
  assert.deepEqual(withoutPid(theirs, 100), theirs, 'the next scheduler keeps its pid')
  assert.deepEqual(withoutPid({ ...DEFAULT_STATE, on: true }, 100), { ...DEFAULT_STATE, on: true })
})

test('a run of a scheduled command commits its work until a person picks a level on this machine; nothing is a pick too', () => {
  assert.equal(publishInForce(DEFAULT_STATE, 'work-queue'), 'commit')

  const picked = withPublish(withPublish(DEFAULT_STATE, 'work-queue', 'nothing'), 'triage quick', 'pr')
  assert.deepEqual(picked.publishes, { 'work-queue': 'nothing', 'triage quick': 'pr' })
  assert.equal(publishInForce(picked, 'work-queue'), undefined)
  assert.equal(publishInForce(picked, 'triage quick'), 'pr')
  // Another command is still nobody's pick.
  assert.equal(publishInForce(picked, 'post-merge-cleanup'), 'commit')

  // A pick of commit is kept like any other.
  assert.deepEqual(withPublish(DEFAULT_STATE, 'work-queue', 'commit').publishes, { 'work-queue': 'commit' })

  // A hand-edited state with a word that is no pick: as if nobody picked.
  assert.equal(publishInForce({ ...DEFAULT_STATE, publishes: { 'work-queue': 'push' as never } }, 'work-queue'), 'commit')
})

test("a pace is kept only where a person set one: taking it back leaves no trace, and the command runs at its skill's pace again", () => {
  const since = '2026-10-08T07:00:00.000Z'
  const one = withPace(DEFAULT_STATE, 'update-tickets', { every: '1h', since })
  const two = withPace(one, 'work-queue', { work: true })
  assert.deepEqual(two.paces, { 'update-tickets': { every: '1h', since }, 'work-queue': { work: true } })
  // A new pick replaces the old one.
  assert.deepEqual(withPace(two, 'update-tickets', { every: '2d', at: '10:00', since }).paces!['update-tickets'], { every: '2d', at: '10:00', since })
  const back = withPace(withPace(two, 'update-tickets', undefined), 'work-queue', undefined)
  assert.equal('paces' in back, false)
  // Taking back a pace nobody set changes nothing.
  assert.deepEqual(withPace(one, 'triage quick', undefined), one)
})
