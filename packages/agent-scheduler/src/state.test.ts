import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeGitRunner } from '@openagt/agent-data'
import { DEFAULT_STATE, readState, statePath, updateState, writeState, type State, isSwitchedOn, switchedOnAt, withoutCommand, withSwitch, publishInForce, withPace, withPublish, capInForce, withAgents, namesGivenUp, withoutName, withoutListed, withLastRun } from './state.js'
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
  const MORNING = '2026-10-09T07:00:00.000Z'
  const NOON = '2026-10-09T12:00:00.000Z'
  const on = withSwitch(DEFAULT_STATE, 'post-merge-cleanup', MORNING)
  assert.deepEqual(on.switches, { 'post-merge-cleanup': MORNING }, 'the switch holds when it was switched on')
  assert.equal(isSwitchedOn(on, 'post-merge-cleanup'), true)
  assert.equal(switchedOnAt(on, 'post-merge-cleanup'), MORNING)
  assert.equal(isSwitchedOn(on, 'work-queue'), false)
  assert.equal(switchedOnAt(on, 'work-queue'), undefined)
  // Switching off a command nobody switched on keeps nothing of it.
  const both = withSwitch(withSwitch(on, 'triage quick', NOON), 'work-queue', undefined)
  assert.deepEqual(both.switches, { 'post-merge-cleanup': MORNING, 'triage quick': NOON })
  const back = withSwitch(withSwitch(both, 'triage quick', undefined), 'post-merge-cleanup', undefined)
  assert.equal('switches' in back, false)
  // A state edited by hand: anything but a time is off.
  assert.equal(isSwitchedOn({ ...DEFAULT_STATE, switches: { 'work-queue': 'on' } }, 'work-queue'), false)
  assert.equal(isSwitchedOn({ ...DEFAULT_STATE, switches: { 'work-queue': true as never } }, 'work-queue'), false)
  // Text a date would read loosely is no time either: `1` reads as the year 2001.
  for (const loose of ['1', '2026', 'October 9']) assert.equal(isSwitchedOn({ ...DEFAULT_STATE, switches: { 'work-queue': loose } }, 'work-queue'), false, loose)
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

test("the cap in force is this machine's number of agents at once, else the skill's; it is kept only where a person set one", () => {
  const skill = { name: 'work-queue', cap: 1 }
  assert.equal(capInForce(DEFAULT_STATE, skill), 1)
  assert.equal(capInForce(DEFAULT_STATE, { name: 'plan-tickets', cap: 2 }), 2)
  const mine = withAgents(withAgents(DEFAULT_STATE, 'work-queue', 3), 'triage quick', 1)
  assert.deepEqual(mine.agents, { 'work-queue': 3, 'triage quick': 1 })
  assert.equal(capInForce(mine, skill), 3)
  // 99 is the top, and a pick.
  assert.equal(capInForce({ ...DEFAULT_STATE, agents: { 'work-queue': 99 } }, skill), 99)
  // A number below the skill's is a pick too.
  assert.equal(capInForce(mine, { name: 'triage quick', cap: 4 }), 1)
  // Another command still has its skill's.
  assert.equal(capInForce(mine, { name: 'plan-tickets', cap: 2 }), 2)
  // A state edited by hand: a value that is no whole number above 0 is no number set.
  for (const odd of [0, -1, 1.5, 100, '3', null, Number.NaN]) assert.equal(capInForce({ ...DEFAULT_STATE, agents: { 'work-queue': odd as never } }, skill), 1, String(odd))
  const back = withAgents(withAgents(mine, 'work-queue', undefined), 'triage quick', undefined)
  assert.equal('agents' in back, false)
  assert.deepEqual(withAgents(mine, 'plan-tickets', undefined), mine)
})

test('nothing left of one command: its switch, publish pick, pace and number of agents go, the others stay; a state that holds nothing of it is answered as it is', () => {
  const at = '2026-10-09T07:00:00.000Z'
  const state = { ...DEFAULT_STATE, switches: { tidy: at, 'work-queue': at }, publishes: { tidy: 'merge' as const }, paces: { tidy: { every: '5m', since: at }, 'work-queue': { work: true as const } }, agents: { tidy: 3 } }
  assert.deepEqual(withoutCommand(state, 'tidy'), { ...DEFAULT_STATE, switches: { 'work-queue': at }, paces: { 'work-queue': { work: true } } })
  assert.equal(withoutCommand(state, 'never-heard-of'), state)
  assert.equal(withoutCommand(DEFAULT_STATE, 'tidy'), DEFAULT_STATE)
})

test("a command removed since the last tick is taken off that tick's record, the schedule it read and what it decided, and nothing else of the state changes", () => {
  const at = '2026-10-09T07:00:00.000Z'
  const lastTick = { at, note: 'off', decisions: [{ command: 'tidy', outcome: 'not due' }, { command: 'work-queue', outcome: 'started r1', run: 'r1' }], schedule: [{ command: 'tidy', every: '1d', onThisMachine: true as const, editable: true as const }, { command: 'work-queue', when: 'npx queue' }] }
  const state = { ...DEFAULT_STATE, switches: { tidy: at }, lastTick }
  assert.deepEqual(withoutListed(state, 'tidy'), { ...DEFAULT_STATE, switches: { tidy: at }, lastTick: { at, note: 'off', decisions: [{ command: 'work-queue', outcome: 'started r1', run: 'r1' }], schedule: [{ command: 'work-queue', when: 'npx queue' }] } })
  // A line that says an automation of that name is not listed goes too: its file is gone.
  assert.deepEqual(withoutListed({ ...DEFAULT_STATE, lastTick: { at, decisions: [{ command: 'tidy', outcome: 'unlisted automation: it has no schedule' }], schedule: [] } }, 'tidy').lastTick, { at, decisions: [], schedule: [] })
  // Nothing of that name on the record, and no record: the state itself, so a caller can tell there is nothing to write.
  assert.equal(withoutListed(state, 'never-heard-of'), state)
  assert.equal(withoutListed(DEFAULT_STATE, 'tidy'), DEFAULT_STATE)
})

test("a run started by hand since the last tick is that command's last run on the tick's record, in place of the one before it; a command the record does not list changes nothing", () => {
  const at = '2026-10-09T07:00:00.000Z'
  const lastTick = { at, decisions: [], schedule: [{ command: 'tidy', every: '1d', lastRun: { id: 'r1', at, failed: true as const } }, { command: 'work-queue', when: 'npx queue' }] }
  const state = { ...DEFAULT_STATE, lastTick }
  const run = { id: 'r2', at: '2026-10-09T08:00:00.000Z' }
  assert.deepEqual(withLastRun(state, 'tidy', run).lastTick?.schedule, [{ command: 'tidy', every: '1d', lastRun: run }, { command: 'work-queue', when: 'npx queue' }])
  assert.deepEqual(withLastRun(state, 'work-queue', run).lastTick?.schedule[1], { command: 'work-queue', when: 'npx queue', lastRun: run })
  assert.equal(withLastRun(state, 'never-heard-of', run), state)
  assert.equal(withLastRun(DEFAULT_STATE, 'tidy', run), DEFAULT_STATE)
})

test("what an automation kept on this machine was given goes when it goes, and when a skill has its name too: the names given up, and the state with nothing left under a name, a skill's commands with a word included", () => {
  const at = '2026-10-09T07:00:00.000Z'
  const lastTick = { at, decisions: [], schedule: [{ command: 'answer-comments', onThisMachine: true as const }, { command: 'watch-competitor', onThisMachine: true as const }, { command: 'work-queue' }] }
  const kept = { name: 'watch-competitor', text: 'Look.' }
  // Its file was removed, or renamed: the last tick listed it, this one does not.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept, { name: 'work-queue' }] }), ['answer-comments'])
  // Still kept here: nothing is given up. A skill that is gone gives nothing up either: its switch can be taken back by hand.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept, { name: 'answer-comments', text: 'Answer.' }] }), [])
  // The name went to a skill of the project: given up, so the skill starts off like any that arrives.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept, { name: 'answer-comments' }] }), ['answer-comments'])
  // Its file is still there, with a slip that keeps it off the list: its picks wait for the fix.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept], unreadable: [{ skill: 'answer-comments', own: true }] }), [])
  // A skill of that name whose schedule cannot be read is no such file.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept], unreadable: [{ skill: 'answer-comments' }] }), ['answer-comments'])
  // A name a skill and an automation kept here both have, each named once.
  assert.deepEqual(namesGivenUp(lastTick, { commands: [kept], clashes: ['answer-comments', 'triage'] }), ['answer-comments', 'triage'])
  assert.deepEqual(namesGivenUp(undefined, { commands: [kept] }), [])

  const state = { ...DEFAULT_STATE, switches: { triage: at, 'triage quick': at, 'triage-all': at }, publishes: { 'triage quick': 'merge' as const }, paces: { 'triage consensual': { work: true as const } }, agents: { triage: 3, 'work-queue': 2 } }
  assert.deepEqual(withoutName(state, 'triage'), { ...DEFAULT_STATE, switches: { 'triage-all': at }, agents: { 'work-queue': 2 } })
  assert.equal(withoutName(state, 'never-heard-of'), state)
})
