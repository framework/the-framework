import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { DriverQuota } from 'agent-driver'
import type { RunCard } from '@gemstack/skill-logs'
import { DEFAULT_STATE, type State } from './state.js'
import { parseSchedule } from './schedule.js'
import { tick, type TickDeps } from './tick.js'

// The tick's decisions with every reading injected: what it reads, in which order, and the one
// line each outcome leaves in the state. The wiring to a real project is scheduler.ts's.

const NOW = new Date('2026-09-16T14:01:00.000Z')

/** A week that resets four days out, with the account's week at `percentUsed`. */
function quota(percentUsed: number): DriverQuota {
  const resets = new Date(NOW.getTime() + 4 * 24 * 60 * 60 * 1000)
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][resets.getUTCMonth()]
  return { available: true, windows: [{ label: 'Current week (all models)', kind: 'week', percentUsed, resetsAtText: `${month} ${resets.getUTCDate()} at 7am (UTC)` }] }
}

function running(id: string, command: string, host = 'other-box'): RunCard {
  return { id, startedAt: '2026-09-16T13:00:00.000Z', status: 'running', intent: `/${command}`, caller: { runner: { host } } }
}

interface Seen {
  markers: RunCard[]
  withdrawn: string[]
  spawned: { id: string; prompt: string; model: string }[]
  checks: string[]
}

function deps(over: Partial<TickDeps> & { stateOver?: Partial<State>; md?: string; inFlightCards?: RunCard[]; seen?: Seen } = {}): { deps: TickDeps; seen: Seen } {
  const seen: Seen = over.seen ?? { markers: [], withdrawn: [], spawned: [], checks: [] }
  let ids = 0
  const cards = over.inFlightCards ?? []
  const d: TickDeps = {
    state: { ...DEFAULT_STATE, on: true, spendOffset: 0, ...over.stateOver },
    schedule: parseSchedule(over.md ?? '- work-queue: when `npx queue`, cap 1\n'),
    host: 'this-box',
    now: () => NOW,
    pull: async () => ({ ok: true }),
    sweep: async () => {},
    hasCommand: async () => true,
    check: async shell => {
      seen.checks.push(shell)
      return { ok: true, stdout: '["one entry"]', stderr: '' }
    },
    lastStart: async () => undefined,
    inFlight: async command => [...cards, ...seen.markers].filter(c => c.status === 'running' && c.intent === `/${command}`),
    ready: async () => ({ problems: [], warnings: [] }),
    quota: async () => quota(10),
    mint: () => `2026-09-16T14-01-00-00${ids++}Z`,
    writeMarker: async card => {
      seen.markers.push(card)
      return { ok: true, changed: true, pushed: true }
    },
    withdrawMarker: async id => {
      seen.markers.splice(seen.markers.findIndex(c => c.id === id), 1)
      seen.withdrawn.push(id)
    },
    spawn: async run => {
      seen.spawned.push(run)
    },
    driver: 'fake',
    ...over,
  }
  return { deps: d, seen }
}

test('an interval: never started is due; a start inside the interval is not due, with the age and the interval, and runs no check; a start past it is due', async () => {
  const md = '- triage-quick: every 6h\n- update-tickets: every 1h, when `gh issue list`\n'
  const never = deps({ md })
  const first = await tick(never.deps)
  assert.deepEqual(first.decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['started', 'started'])
  assert.deepEqual(never.seen.checks, ['gh issue list'], 'the interval passed, so the check decided')

  const starts: Record<string, string> = { 'triage-quick': '2026-09-16T11:30:00.000Z', 'update-tickets': '2026-09-16T13:59:30.000Z' }
  const recent = deps({ md, lastStart: async command => starts[command] })
  const second = await tick(recent.deps)
  assert.deepEqual(second.decisions, [
    { command: 'triage-quick', outcome: 'not due (last start 2h ago, every 6h)' },
    { command: 'update-tickets', outcome: 'not due (last start 1m ago, every 1h)' },
  ])
  assert.deepEqual(recent.seen.checks, [], 'no check runs while the interval holds')
  assert.equal(recent.seen.markers.length, 0)

  const old = deps({ md, lastStart: async () => '2026-09-15T14:00:00.000Z' })
  const third = await tick(old.deps)
  assert.deepEqual(third.decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['started', 'started'])
  assert.deepEqual(old.seen.checks, ['gh issue list'])
})

test('a due command under its cap with quota to spare is marked on the branch, then spawned, and the state says so', async () => {
  const { deps: d, seen } = deps()
  const record = await tick(d)
  assert.deepEqual(record.decisions, [{ command: 'work-queue', outcome: 'started 2026-09-16T14-01-00-000Z', run: '2026-09-16T14-01-00-000Z' }])
  assert.deepEqual(seen.checks, ['npx queue'])
  assert.equal(seen.markers.length, 1)
  const marker = seen.markers[0]!
  assert.equal(marker.status, 'running')
  assert.equal(marker.intent, '/work-queue')
  assert.equal(marker.model, 'opus')
  assert.deepEqual(marker.caller, { runner: { host: 'this-box' } })
  assert.equal(marker.intent, '/work-queue')
  assert.deepEqual(seen.spawned, [{ id: marker.id, prompt: '/work-queue', model: 'opus' }])
})

test('a command with a word after its folder name: the folder is looked up, the whole name is what the switch, the interval, the marker and the decision carry, and the prompt is the name with a slash', async () => {
  const md = '- triage quick: every 6h\n- triage consensual: every 7d\n'
  const looked: string[] = []
  const started: Record<string, string> = { 'triage consensual': '2026-09-15T14:00:00.000Z' }
  const { deps: d, seen } = deps({
    md,
    hasCommand: async name => {
      looked.push(name)
      return name === 'triage'
    },
    lastStart: async command => started[command],
    stateOver: { switches: { 'triage consensual': false } },
  })
  const record = await tick(d)
  assert.deepEqual(looked, ['triage', 'triage'])
  assert.deepEqual(record.decisions, [
    { command: 'triage quick', outcome: 'started 2026-09-16T14-01-00-000Z', run: '2026-09-16T14-01-00-000Z' },
    { command: 'triage consensual', outcome: 'switched off on this machine' },
  ])
  assert.equal(seen.markers[0]!.intent, '/triage quick')
  assert.deepEqual(seen.markers[0]!.caller, { runner: { host: 'this-box' } })
  assert.equal(seen.markers[0]!.intent, '/triage quick')
  assert.deepEqual(seen.spawned, [{ id: '2026-09-16T14-01-00-000Z', prompt: '/triage quick', model: 'opus' }])
  assert.deepEqual(record.schedule, [
    { command: 'triage quick', every: '6h', on: true },
    { command: 'triage consensual', every: '7d', on: true },
  ])

  // The interval is the whole name's: the consensual start is not the quick one's.
  const paced = deps({ md, hasCommand: async () => true, lastStart: async command => started[command] })
  const second = await tick(paced.deps)
  assert.deepEqual(second.decisions.map(dec => dec.outcome.replace(/ 2026.*$/, '')), ['started', 'not due (last start 1d ago, every 7d)'])
})

test('off: the pull and the sweep still run, nothing is decided', async () => {
  let swept = false
  const { deps: d, seen } = deps({ stateOver: { on: false }, sweep: async () => { swept = true } })
  const record = await tick(d)
  assert.equal(record.note, 'off')
  assert.equal(swept, true)
  assert.deepEqual(record.decisions, [])
  assert.deepEqual(seen.checks, [])
})

test('a command switched off on this machine is not started, and says so; a line listed `off` runs where a machine switched it on', async () => {
  const md = '- work-queue: when `npx queue`\n- post-merge-cleanup: every 1d, off\n'
  const nobody = deps({ md })
  const record = await tick(nobody.deps)
  assert.deepEqual(record.decisions.map(d => [d.command, d.outcome.split(' ')[0]]), [['work-queue', 'started'], ['post-merge-cleanup', 'switched']])
  assert.equal(record.decisions[1]!.outcome, 'switched off on this machine')
  // The tick lists what the lines say, whatever this machine switched.
  assert.deepEqual(record.schedule, [
    { command: 'work-queue', when: 'npx queue', on: true },
    { command: 'post-merge-cleanup', every: '1d', on: false },
  ])

  const switched = deps({ md, stateOver: { switches: { 'work-queue': false, 'post-merge-cleanup': true } } })
  const after = await tick(switched.deps)
  assert.deepEqual(after.decisions.map(d => [d.command, d.outcome.split(' ')[0]]), [['work-queue', 'switched'], ['post-merge-cleanup', 'started']])
  // Switched off, its check never ran.
  assert.deepEqual(switched.seen.checks, [])
})

test('a pull that fails ends the tick with the reason: a stale branch must not start anything', async () => {
  const { deps: d, seen } = deps({ pull: async () => ({ ok: false, error: 'origin is unreachable' }) })
  const record = await tick(d)
  assert.equal(record.note, 'agent-data could not be pulled: origin is unreachable')
  assert.deepEqual(seen.spawned, [])
})

test('no schedule file, no decisions', async () => {
  const { deps: d } = deps({ schedule: undefined })
  assert.equal((await tick(d)).note, 'no agent-schedule.md')
})

test('the checks in order: no such command, check failed, not due, cap reached, quota', async () => {
  const noCommand = deps({ hasCommand: async () => false })
  assert.deepEqual((await tick(noCommand.deps)).decisions, [{ command: 'work-queue', outcome: 'no such command in this project' }])
  assert.deepEqual(noCommand.seen.checks, [], 'a project without the command is not checked')

  const failed = deps({ check: async () => ({ ok: false, stdout: '', stderr: 'npm ERR! missing script\nnot found: queue' }) })
  assert.deepEqual((await tick(failed.deps)).decisions, [{ command: 'work-queue', outcome: 'check failed: not found: queue' }])

  const notDue = deps({ check: async () => ({ ok: true, stdout: '[]\n', stderr: '' }) })
  assert.deepEqual((await tick(notDue.deps)).decisions, [{ command: 'work-queue', outcome: 'not due' }])

  const capped = deps({ inFlightCards: [running('2026-09-16T13-00-00-000Z', 'work-queue')] })
  let quotaRead = false
  capped.deps.quota = async () => { quotaRead = true; return quota(10) }
  assert.deepEqual((await tick(capped.deps)).decisions, [{ command: 'work-queue', outcome: 'cap reached (1 in flight: 2026-09-16T13-00-00-000Z on other-box)' }])
  assert.equal(quotaRead, false, 'the quota is read only when everything else says start')
  assert.deepEqual(capped.seen.markers, [])

  const spent = deps({ quota: async () => quota(90) })
  const decisions = (await tick(spent.deps)).decisions
  assert.equal(decisions.length, 1)
  assert.match(decisions[0]!.outcome, /^quota: Current week \(all models\) is 90% used, at or past day 4 of the week's \d+%$/)
  assert.deepEqual(spent.seen.spawned, [])
})

test('a coding agent that cannot start starts nothing: said once per tick, before the quota is read, and nothing is marked', async () => {
  let reads = 0
  let quotaRead = false
  const { deps: d, seen } = deps({
    md: '- a: when `x`\n- b: when `y`\n',
    ready: async () => { reads++; return { problems: ['`claude` is not logged in. Run `claude auth login`, then start again.'], warnings: [] } },
    quota: async () => { quotaRead = true; return quota(10) },
  })
  assert.deepEqual((await tick(d)).decisions, [
    { command: 'a', outcome: 'not ready: `claude` is not logged in. Run `claude auth login`, then start again.' },
    { command: 'b', outcome: 'not ready: `claude` is not logged in. Run `claude auth login`, then start again.' },
  ])
  assert.equal(reads, 1)
  assert.equal(quotaRead, false)
  assert.deepEqual(seen.markers, [])

  const capped = deps({ inFlightCards: [running('2026-09-16T13-00-00-000Z', 'work-queue')], ready: async () => { reads++; return { problems: [], warnings: [] } } })
  await tick(capped.deps)
  assert.equal(reads, 1, 'the agent is asked only when everything cheaper says start')
})

test("an unreadable quota stands the tick down: not knowing is not 'nothing used'", async () => {
  const { deps: d } = deps({ quota: async () => ({ available: false, reason: 'timeout' }) })
  assert.deepEqual((await tick(d)).decisions, [{ command: 'work-queue', outcome: 'quota: the quota could not be read, so there is no way to tell what is spare' }])
})

test("a marker that lands past the cap is withdrawn: the first `cap` ids in time order are the runs", async () => {
  // Another machine's marker landed between this tick's count and its write, with an earlier id.
  const cards: RunCard[] = []
  const { deps: d, seen } = deps({ inFlightCards: cards })
  const write = d.writeMarker
  d.writeMarker = async card => {
    cards.push(running('2026-09-16T14-00-59-000Z', 'work-queue'))
    return write(card)
  }
  const record = await tick(d)
  assert.deepEqual(seen.withdrawn, ['2026-09-16T14-01-00-000Z'])
  assert.deepEqual(seen.spawned, [])
  assert.deepEqual(record.decisions, [{ command: 'work-queue', outcome: 'cap reached (1 in flight: 2026-09-16T14-00-59-000Z on other-box)' }])
})

test('with a cap of two, the marker within the cap keeps its place even when a later one lands too', async () => {
  const cards: RunCard[] = []
  const { deps: d, seen } = deps({ md: '- work-queue: when `npx queue`, cap 2\n', inFlightCards: cards })
  const write = d.writeMarker
  d.writeMarker = async card => {
    cards.push(running('2026-09-16T14-01-30-000Z', 'work-queue'))
    return write(card)
  }
  await tick(d)
  assert.deepEqual(seen.withdrawn, [])
  assert.equal(seen.spawned.length, 1)
})

test('a marker whose push failed twice is withdrawn and nothing is spawned', async () => {
  const { deps: d, seen } = deps({ writeMarker: async () => ({ ok: false, committed: true, error: 'the agent-data branch could not be pushed: rejected' }) })
  const record = await tick(d)
  assert.deepEqual(record.decisions, [{ command: 'work-queue', outcome: 'another machine got there first: the agent-data branch could not be pushed: rejected' }])
  assert.deepEqual(seen.withdrawn, ['2026-09-16T14-01-00-000Z'])
  assert.deepEqual(seen.spawned, [])
})

test('an unreadable schedule line is named in the state and the readable ones still run', async () => {
  const { deps: d, seen } = deps({ md: '- Work Queue: daily\n- work-queue: when `npx queue`\n' })
  const record = await tick(d)
  assert.deepEqual(record.decisions.map(x => [x.command, x.outcome.split(' ')[0]]), [['line 1', 'unreadable:'], ['work-queue', 'started']])
  assert.equal(seen.spawned.length, 1)
})

test('the quota is read once per tick, however many commands start', async () => {
  let reads = 0
  const { deps: d, seen } = deps({ md: '- a: when `x`\n- b: when `y`\n', quota: async () => { reads++; return quota(1) } })
  await tick(d)
  assert.equal(seen.spawned.length, 2)
  assert.equal(reads, 1)
})

test('a stop that came in during the tick starts nothing: no marker, no spawn, the decision says so', async () => {
  const { deps: d, seen } = deps({ stopped: () => true })
  const record = await tick(d)
  assert.deepEqual(record.decisions, [{ command: 'work-queue', outcome: 'not started: the scheduler was stopped' }])
  assert.equal(seen.markers.length, 0)
  assert.equal(seen.spawned.length, 0)
  assert.deepEqual(seen.checks, ['npx queue'], 'the readings before it still ran')
})
