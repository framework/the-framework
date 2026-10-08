import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { DriverQuota } from '@openagt/agent-driver'
import type { RunCard } from '@openagt/skill-logs'
import { DEFAULT_STATE, type State } from './state.js'
import { parseInterval, type Interval } from './pace.js'
import type { ScheduledCommand } from './schedule.js'
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

/** An interval as a skill writes it: `6h`. */
const every = (text: string): Interval => parseInterval(text)!

/** A scheduled command with a check and a cap of one, its skill in Claude Code's folder, unless said otherwise. */
function command(name: string, over: Partial<ScheduledCommand> = { when: 'npx queue' }): ScheduledCommand {
  return { name, cap: 1, dir: '.claude/skills', ...over }
}

interface Seen {
  markers: RunCard[]
  withdrawn: string[]
  spawned: { id: string; prompt: string; model: string; publish?: string }[]
  checks: string[]
}

/** Every command switched on on this machine, unless the state says otherwise: a command nobody switched on starts nothing. */
function deps(over: Partial<TickDeps> & { stateOver?: Partial<State>; commands?: ScheduledCommand[]; inFlightCards?: RunCard[]; seen?: Seen } = {}): { deps: TickDeps; seen: Seen } {
  const seen: Seen = over.seen ?? { markers: [], withdrawn: [], spawned: [], checks: [] }
  let ids = 0
  const cards = over.inFlightCards ?? []
  const commands = over.commands ?? [command('work-queue')]
  const d: TickDeps = {
    state: { ...DEFAULT_STATE, on: true, spendOffset: 0, switches: Object.fromEntries(commands.map(c => [c.name, true as const])), ...over.stateOver },
    schedule: { commands, unreadable: [] },
    host: 'this-box',
    now: () => NOW,
    pull: async () => ({ ok: true }),
    sweep: async () => {},
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
  const commands = [command('triage-quick', { every: every('6h') }), command('update-tickets', { every: every('1h'), when: 'gh issue list' })]
  const never = deps({ commands })
  const first = await tick(never.deps)
  assert.deepEqual(first.decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['started', 'started'])
  assert.deepEqual(never.seen.checks, ['gh issue list'], 'the interval passed, so the check decided')

  const starts: Record<string, string> = { 'triage-quick': '2026-09-16T11:30:00.000Z', 'update-tickets': '2026-09-16T13:59:30.000Z' }
  const recent = deps({ commands, lastStart: async name => starts[name] })
  const second = await tick(recent.deps)
  assert.deepEqual(second.decisions, [
    { command: 'triage-quick', outcome: 'not due (last start 2h ago, every 6h)' },
    { command: 'update-tickets', outcome: 'not due (last start 1m ago, every 1h)' },
  ])
  assert.deepEqual(recent.seen.checks, [], 'no check runs while the interval holds')
  assert.equal(recent.seen.markers.length, 0)

  const old = deps({ commands, lastStart: async () => '2026-09-15T14:00:00.000Z' })
  const third = await tick(old.deps)
  assert.deepEqual(third.decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['started', 'started'])
  assert.deepEqual(old.seen.checks, ['gh issue list'])
})

test("this machine's pace stands in for the skill's: its own interval, or whenever there is work; a pace too large to be one leaves the skill's; the recorded schedule still says the skill's", async () => {
  const commands = [command('update-tickets', { every: every('15m'), when: 'gh issue list' }), command('plan-tickets', { every: every('6h'), when: 'npx tickets list' }), command('triage quick', { every: every('6h') })]
  // All three last started 20 minutes ago.
  const lastStart = async (): Promise<string> => new Date(NOW.getTime() - 20 * 60_000).toISOString()
  const skills = deps({ commands, lastStart })
  assert.deepEqual((await tick(skills.deps)).decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['started', 'not due (last start 20m ago, every 6h)', 'not due (last start 20m ago, every 6h)'])

  const since = '2026-09-01T00:00:00.000Z'
  const mine = deps({ commands, lastStart, stateOver: { switches: { 'update-tickets': true, 'plan-tickets': true, 'triage quick': true }, paces: { 'update-tickets': { every: '1h', since }, 'plan-tickets': { work: true }, 'triage quick': { every: '10m', since } } } })
  const record = await tick(mine.deps)
  assert.deepEqual(record.decisions.map(d => d.outcome.replace(/ 2026.*$/, '')), ['not due (last start 20m ago, every 1h)', 'started', 'started'])
  // Slowed down, its check never ran; "whenever there is work" asked the check alone.
  assert.deepEqual(mine.seen.checks, ['npx tickets list'])
  assert.deepEqual(record.schedule.map(row => [row.command, row.every]), [['update-tickets', '15m'], ['plan-tickets', '6h'], ['triage quick', '6h']])

  // A count no date can hold must never read as "due on every tick": it is no pace, and the skill's stands.
  const huge = deps({ commands, lastStart, stateOver: { switches: { 'plan-tickets': true }, paces: { 'plan-tickets': { every: '100000000d', at: '10:00', since } } } })
  assert.deepEqual((await tick(huge.deps)).decisions.filter(d => d.command === 'plan-tickets'), [{ command: 'plan-tickets', outcome: 'not due (last start 20m ago, every 6h)' }])
})

test('a pace with a time of day: not due before that time, with the time it is due from; due from then on, and a missed time starts once', async () => {
  const commands = [command('post-merge-cleanup', { every: every('1h'), when: 'gh pr list' })]
  // The machine's own local time: the 16th at 09:00, last started on the 14th at 10:02.
  const local = (day: number, hour: number, minute = 0): Date => new Date(2026, 8, day, hour, minute)
  const paces = { 'post-merge-cleanup': { every: '2d', at: '10:00', since: local(1, 8).toISOString() } }
  const early = deps({ commands, now: () => local(16, 9), lastStart: async () => local(14, 10, 2).toISOString(), stateOver: { switches: { 'post-merge-cleanup': true }, paces } })
  assert.deepEqual((await tick(early.deps)).decisions, [{ command: 'post-merge-cleanup', outcome: 'not due (next start from 2026-09-16 10:00, every 2d at 10:00)' }])
  assert.deepEqual(early.seen.checks, [], 'no check runs before the time')

  const onTime = deps({ commands, now: () => local(16, 10), lastStart: async () => local(14, 10, 2).toISOString(), stateOver: { switches: { 'post-merge-cleanup': true }, paces } })
  assert.match((await tick(onTime.deps)).decisions[0]!.outcome, /^started /)
  assert.deepEqual(onTime.seen.checks, ['gh pr list'], 'from the time on, the check decides')

  // The scheduler was not running on the 16th at 10:00: on the 17th at 08:00 the missed time is due, once.
  const late = deps({ commands, now: () => local(17, 8), lastStart: async () => local(14, 10, 2).toISOString(), stateOver: { switches: { 'post-merge-cleanup': true }, paces } })
  assert.match((await tick(late.deps)).decisions[0]!.outcome, /^started /)
  const after = deps({ commands, now: () => local(17, 10, 5), lastStart: async () => local(17, 8).toISOString(), stateOver: { switches: { 'post-merge-cleanup': true }, paces } })
  assert.deepEqual((await tick(after.deps)).decisions, [{ command: 'post-merge-cleanup', outcome: 'not due (next start from 2026-09-19 10:00, every 2d at 10:00)' }])
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
  // Nobody picked a publish level on this machine: the run commits its work.
  assert.deepEqual(marker.caller, { runner: { host: 'this-box', publish: 'commit' }, host: 'this-box' })
  assert.deepEqual(seen.spawned, [{ id: marker.id, prompt: '/work-queue', model: 'opus', publish: 'commit' }])
})

test("this machine's publish pick goes on the marker and to the spawned run: commit where nobody picked, no level for nothing; the recorded schedule says what the skills say, with what each skill says it does", async () => {
  const commands = [command('work-queue', { when: 'npx queue', waitsFor: 'when the queue holds a task', description: 'Work one queued task.' }), command('triage quick', { every: every('6h') }), command('plan-tickets', { every: every('6h') })]
  const { deps: d, seen } = deps({ commands, stateOver: { switches: { 'work-queue': true, 'triage quick': true, 'plan-tickets': true }, publishes: { 'work-queue': 'nothing', 'triage quick': 'merge' } } })
  const record = await tick(d)
  assert.deepEqual(seen.markers.map(m => m.caller), [
    { runner: { host: 'this-box' }, host: 'this-box' },
    { runner: { host: 'this-box', publish: 'merge' }, host: 'this-box' },
    { runner: { host: 'this-box', publish: 'commit' }, host: 'this-box' },
  ])
  assert.deepEqual(seen.spawned.map(s => [s.prompt, s.publish]), [['/work-queue', undefined], ['/triage quick', 'merge'], ['/plan-tickets', 'commit']])
  assert.deepEqual(record.schedule, [
    { command: 'work-queue', when: 'npx queue', waitsFor: 'when the queue holds a task', description: 'Work one queued task.' },
    { command: 'triage quick', every: '6h' },
    { command: 'plan-tickets', every: '6h' },
  ])
})

test('a command with a word after its folder name: the whole name is what the switch, the interval, the marker and the decision carry, and the prompt is the name with a slash', async () => {
  const commands = [command('triage quick', { every: every('6h') }), command('triage consensual', { every: every('7d') })]
  const started: Record<string, string> = { 'triage consensual': '2026-09-15T14:00:00.000Z' }
  const { deps: d, seen } = deps({ commands, lastStart: async name => started[name], stateOver: { switches: { 'triage quick': true } } })
  const record = await tick(d)
  assert.deepEqual(record.decisions, [
    { command: 'triage quick', outcome: 'started 2026-09-16T14-01-00-000Z', run: '2026-09-16T14-01-00-000Z' },
    { command: 'triage consensual', outcome: 'switched off on this machine' },
  ])
  assert.equal(seen.markers[0]!.intent, '/triage quick')
  assert.deepEqual(seen.spawned, [{ id: '2026-09-16T14-01-00-000Z', prompt: '/triage quick', model: 'opus', publish: 'commit' }])
  assert.deepEqual(record.schedule, [
    { command: 'triage quick', every: '6h' },
    { command: 'triage consensual', every: '7d' },
  ])

  // The interval is the whole name's: the consensual start is not the quick one's.
  const paced = deps({ commands, lastStart: async name => started[name] })
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

test('every command starts switched off: it is not started, and says so, until a person switches it on on this machine', async () => {
  const commands = [command('work-queue'), command('post-merge-cleanup', { every: every('1d') })]
  const nobody = deps({ commands, stateOver: { switches: {} } })
  const record = await tick(nobody.deps)
  assert.deepEqual(record.decisions, [
    { command: 'work-queue', outcome: 'switched off on this machine' },
    { command: 'post-merge-cleanup', outcome: 'switched off on this machine' },
  ])
  // Switched off, its check never ran.
  assert.deepEqual(nobody.seen.checks, [])
  // The tick lists what the skills say, whatever this machine switched.
  assert.deepEqual(record.schedule, [
    { command: 'work-queue', when: 'npx queue' },
    { command: 'post-merge-cleanup', every: '1d' },
  ])

  const switched = deps({ commands, stateOver: { switches: { 'post-merge-cleanup': true } } })
  const after = await tick(switched.deps)
  assert.deepEqual(after.decisions.map(d => [d.command, d.outcome.split(' ')[0]]), [['work-queue', 'switched'], ['post-merge-cleanup', 'started']])
  assert.deepEqual(switched.seen.checks, [])

  // A state edited by hand: anything but true is off.
  const edited = deps({ commands, stateOver: { switches: { 'work-queue': 'yes' as never } } })
  assert.equal((await tick(edited.deps)).decisions[0]!.outcome, 'switched off on this machine')
})

test('a pull that fails ends the tick with the reason: a stale branch must not start anything', async () => {
  const { deps: d, seen } = deps({ pull: async () => ({ ok: false, error: 'origin is unreachable' }) })
  const record = await tick(d)
  assert.equal(record.note, 'agent-data could not be pulled: origin is unreachable')
  assert.deepEqual(seen.spawned, [])
})

test('no skill schedules a command: no decisions, and the note says so', async () => {
  const { deps: d } = deps({ commands: [] })
  const record = await tick(d)
  assert.equal(record.note, 'no skill of this project schedules a command')
  assert.deepEqual(record.schedule, [])
})

test('the checks in order: not a command of the coding agent, check failed, not due, cap reached, quota', async () => {
  // Its skill is only in the folder another coding agent reads: Claude Code would be handed a command it cannot expand.
  const elsewhere = deps({ commands: [command('work-queue', { when: 'npx queue', dir: '.agents/skills' })] })
  assert.deepEqual((await tick(elsewhere.deps)).decisions, [{ command: 'work-queue', outcome: 'not a command of the coding agent: its skill is only under .agents/skills, not .claude/skills' }])
  assert.deepEqual(elsewhere.seen.checks, [], 'a command that cannot run is not checked')
  assert.deepEqual(elsewhere.seen.spawned, [])
  // Said before the switch: a person reads why switching it on would start nothing.
  const unswitched = deps({ commands: elsewhere.deps.schedule.commands, stateOver: { switches: {} } })
  assert.match((await tick(unswitched.deps)).decisions[0]!.outcome, /^not a command of the coding agent/)

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
    commands: [command('a', { when: 'x' }), command('b', { when: 'y' })],
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
  const { deps: d, seen } = deps({ commands: [command('work-queue', { when: 'npx queue', cap: 2 })], inFlightCards: cards })
  const write = d.writeMarker
  d.writeMarker = async card => {
    cards.push(running('2026-09-16T14-01-30-000Z', 'work-queue'))
    return write(card)
  }
  await tick(d)
  assert.deepEqual(seen.withdrawn, [])
  assert.equal(seen.spawned.length, 1)
})

test("this machine's number of agents at once stands in for the skill's, against every machine's runs: a second one starts under a number of two, none under a number of one where the skill allows two; a marker is ranked by this machine's number", async () => {
  const one = running('2026-09-16T13-00-00-000Z', 'work-queue')
  // The skill says one at a time; this machine's person says two: with one in flight on another machine, a second starts here.
  const more = deps({ inFlightCards: [one], stateOver: { switches: { 'work-queue': true }, agents: { 'work-queue': 2 } } })
  assert.match((await tick(more.deps)).decisions[0]!.outcome, /^started /)
  assert.equal(more.seen.spawned.length, 1)
  // Two in flight: this machine's number is reached.
  const full = deps({ inFlightCards: [one, running('2026-09-16T13-30-00-000Z', 'work-queue', 'third-box')], stateOver: { switches: { 'work-queue': true }, agents: { 'work-queue': 2 } } })
  assert.deepEqual((await tick(full.deps)).decisions, [{ command: 'work-queue', outcome: 'cap reached (2 in flight: 2026-09-16T13-00-00-000Z on other-box, 2026-09-16T13-30-00-000Z on third-box)' }])

  // The skill allows two; this machine's person says one: with one in flight anywhere, nothing starts here.
  const fewer = deps({ commands: [command('work-queue', { when: 'npx queue', cap: 2 })], inFlightCards: [one], stateOver: { switches: { 'work-queue': true }, agents: { 'work-queue': 1 } } })
  assert.match((await tick(fewer.deps)).decisions[0]!.outcome, /^cap reached \(1 in flight/)
  assert.deepEqual(fewer.seen.markers, [])
  // The recorded schedule says the skill's number, and only when it is more than one.
  assert.deepEqual((await tick(fewer.deps)).schedule, [{ command: 'work-queue', when: 'npx queue', agents: 2 }])
  assert.deepEqual((await tick(more.deps)).schedule, [{ command: 'work-queue', when: 'npx queue' }])

  // Another machine's marker lands first: under this machine's number of two its own marker ranks second and stays.
  const cards: RunCard[] = []
  const raced = deps({ inFlightCards: cards, stateOver: { switches: { 'work-queue': true }, agents: { 'work-queue': 2 } } })
  const write = raced.deps.writeMarker
  raced.deps.writeMarker = async card => {
    cards.push(running('2026-09-16T14-00-59-000Z', 'work-queue'))
    return write(card)
  }
  await tick(raced.deps)
  assert.deepEqual(raced.seen.withdrawn, [])
  assert.equal(raced.seen.spawned.length, 1)
})

test('a marker whose push failed twice is withdrawn and nothing is spawned', async () => {
  const { deps: d, seen } = deps({ writeMarker: async () => ({ ok: false, committed: true, error: 'the agent-data branch could not be pushed: rejected' }) })
  const record = await tick(d)
  assert.deepEqual(record.decisions, [{ command: 'work-queue', outcome: 'another machine got there first: the agent-data branch could not be pushed: rejected' }])
  assert.deepEqual(seen.withdrawn, ['2026-09-16T14-01-00-000Z'])
  assert.deepEqual(seen.spawned, [])
})

test("a skill's unreadable schedule is named in the state and the readable commands still run", async () => {
  const { deps: d, seen } = deps()
  d.schedule = { commands: d.schedule.commands, unreadable: [{ skill: 'triage', reason: 'row 2: unknown key evry' }] }
  const record = await tick(d)
  assert.deepEqual(record.decisions.map(x => [x.command, x.outcome.replace(/ 2026.*$/, '')]), [['triage', 'unreadable schedule: row 2: unknown key evry'], ['work-queue', 'started']])
  assert.equal(seen.spawned.length, 1)

  // Nothing readable at all: the unreadable one is still named, not hidden behind "no skill schedules a command".
  const only = deps({ commands: [] })
  only.deps.schedule = { commands: [], unreadable: [{ skill: 'triage', reason: 'the front matter is not YAML' }] }
  const alone = await tick(only.deps)
  assert.equal(alone.note, undefined)
  assert.deepEqual(alone.decisions, [{ command: 'triage', outcome: 'unreadable schedule: the front matter is not YAML' }])

  // With the scheduler off, or the branch not pulled, it is named all the same: nothing else says why the commands are missing.
  const off = deps({ stateOver: { on: false } })
  off.deps.schedule = only.deps.schedule
  const idle = await tick(off.deps)
  assert.equal(idle.note, 'off')
  assert.deepEqual(idle.decisions, alone.decisions)
  const stale = deps({ pull: async () => ({ ok: false, error: 'origin is unreachable' }) })
  stale.deps.schedule = only.deps.schedule
  assert.deepEqual((await tick(stale.deps)).decisions, alone.decisions)
})

test('the quota is read once per tick, however many commands start', async () => {
  let reads = 0
  const { deps: d, seen } = deps({ commands: [command('a', { when: 'x' }), command('b', { when: 'y' })], quota: async () => { reads++; return quota(1) } })
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
