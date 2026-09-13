import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import {
  autoPmDecision,
  quotaHeadroom,
  startAutoPm,
  pinnedPlanJob,
  AUTO_PM_JOBS,
  AUTO_PM_WORK_JOB,
  AUTO_PM_MAINTENANCE_JOB,
  AUTO_PM_ROUTINES,
  WORK_QUEUE_SKILL_NAME,
  type AutoPmDeps,
  type AutoPmJob,
  type AutoPmLoop,
  type AutoPmProject,
  type PlanAssignment,
} from './auto-pm.js'
import { quotaBoundaryStatus, type QuotaBoundaryStatus } from './quota-boundary.js'
import { DEFAULT_SPEND_OFFSET, DEFAULT_AUTO_PM_CONCURRENCY } from './preference-defaults.js'
import { presets, type PresetKey } from './preset-catalog.js'

/** 2026-07-20T12:00:00Z. The week below resets in 4 days 19 hours, so ~31.5% has elapsed (#960 Edit). */
const T0 = Date.UTC(2026, 6, 20, 12, 0, 0)

/** A reading where the account's week is `weekPercent` used. */
function status(weekPercent: number): QuotaBoundaryStatus {
  const boundary = quotaBoundaryStatus({
    windows: [{ label: 'Current week (all models)', kind: 'week', percentUsed: weekPercent, resetsAtText: 'Jul 25 at 7am (UTC)' }],
    now: T0,
  })
  if (!boundary) throw new Error('the fixture week should be placeable')
  return boundary
}

/** The happy inputs, so each test names only the condition it is about. */
const IDLE = { enabled: true, activeAgents: 0, quota: status(1) } as const

test('autoPmDecision starts when the budget is barely touched (#685)', () => {
  assert.deepEqual(autoPmDecision(IDLE), { start: true })
})

test('autoPmDecision does nothing while the preference is off (#685)', () => {
  const decision = autoPmDecision({ ...IDLE, enabled: false })
  assert.equal(decision.start, false)
})

test('autoPmDecision leaves a project at its concurrency cap alone (#685/#1204)', () => {
  // Live agents are already spending the quota; one more started unasked would race them. Before
  // #1204 the cap was hardwired at one, which is what `concurrency: 1` still asks for here.
  const decision = autoPmDecision({ ...IDLE, activeAgents: 1, concurrency: 1 })
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /already going/)
})

test('autoPmDecision tops a project up to its concurrency (#1204)', () => {
  // The point of the setting: one agent going is no longer a reason to stand down.
  assert.deepEqual(autoPmDecision({ ...IDLE, activeAgents: 1, concurrency: 2 }), { start: true })
  // At the cap it refuses, and the refusal names the cap so a raised setting does not read as a bug.
  const capped = autoPmDecision({ ...IDLE, activeAgents: 2, concurrency: 2 })
  assert.equal(capped.start, false)
  assert.match(capped.start === false ? capped.reason : '', /at most 2 at once/)
})

test('autoPmDecision defaults to the shipped concurrency, and floors it at one (#1204)', () => {
  // Unset means the default, not one: the absence of the setting has never meant "less".
  assert.equal(autoPmDecision({ ...IDLE, activeAgents: DEFAULT_AUTO_PM_CONCURRENCY - 1 }).start, true)
  assert.equal(autoPmDecision({ ...IDLE, activeAgents: DEFAULT_AUTO_PM_CONCURRENCY }).start, false)
  // Zero agents is what the master switch spells, so a hand-edited nought cannot wedge the routine.
  assert.equal(autoPmDecision({ ...IDLE, activeAgents: 0, concurrency: 0 }).start, true)
  assert.equal(autoPmDecision({ ...IDLE, activeAgents: 1, concurrency: 0 }).start, false)
})

test('autoPmDecision holds off during the cooldown after a start (#685)', () => {
  const decision = autoPmDecision({ ...IDLE, sinceLastStartMs: 60_000 })
  assert.equal(decision.start, false)
  const later = autoPmDecision({ ...IDLE, sinceLastStartMs: 60 * 60_000 })
  assert.deepEqual(later, { start: true })
})

test('autoPmDecision lets an asked-for pass through the cooldown (#1642)', () => {
  // The cooldown paces the unattended rotation; a click is a person asking, so it does not apply.
  const decision = autoPmDecision({ ...IDLE, sinceLastStartMs: 60_000, onDemand: true })
  assert.deepEqual(decision, { start: true })
  // The concurrency cap is not waived with it: that is what stops a second click doubling up.
  const capped = autoPmDecision({ ...IDLE, sinceLastStartMs: 60_000, onDemand: true, activeAgents: 1, concurrency: 1 })
  assert.equal(capped.start, false)
})

test('quotaHeadroom refuses to start when the quota cannot be read (#685)', () => {
  // The inverse of the per-agent guard's fail-open (#519): that one must never STOP the user's
  // own work, this one must never START work nobody asked for on an unknown budget.
  const decision = quotaHeadroom(undefined)
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /could not be read/)
})

test('quotaHeadroom starts while the account is under the boundary (#879)', () => {
  assert.deepEqual(quotaHeadroom(status(1)), { start: true })
})

test('quotaHeadroom stands down at the boundary, and says where it sits (#879)', () => {
  // ~31.5% has elapsed of the week, so a week at 99% is well past it.
  const decision = quotaHeadroom(status(99))
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /99% used, at or past day 3 of the week's 32%/)
})

test('quotaHeadroom names a fractional offset to one decimal, not fifteen digits (#960 Edit)', () => {
  // The half-day default is 100/14 — the reason line should say "+7.1", not the raw double.
  const boundary = quotaBoundaryStatus({
    windows: [{ label: 'Current week (all models)', kind: 'week', percentUsed: 99, resetsAtText: 'Jul 25 at 7am (UTC)' }],
    now: T0,
    limitOffset: DEFAULT_SPEND_OFFSET,
  })
  if (!boundary) throw new Error('the fixture week should be placeable')
  const decision = quotaHeadroom(boundary)
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /your 39% limit \(\+7\.1 on the week's 32%\)/)
})

test('quotaHeadroom stands down the moment the boundary is met, not only when it is passed (#879)', () => {
  // Reads the boundary's own actual value back, rather than assuming a day/7 fraction (#960 Edit):
  // percent is now the continuous elapsed share of the week, not a stepped one.
  const boundaryPercent = status(0).boundary.percent
  const decision = quotaHeadroom(status(boundaryPercent))
  assert.equal(decision.start, false)
})

test('a restarted daemon is no longer blind (#848/#879)', () => {
  // The old rolling meter was delta-based, so a daemon that had just restarted had one sample,
  // nothing to diff it against, and honestly reported 0 consumed while the account sat at 95%
  // of its week. The boundary reads the account's own absolute figure, which owes nothing to
  // how long this process has been up, so the restart is simply not a case any more.
  const decision = autoPmDecision({ enabled: true, activeAgents: 0, quota: status(95) })
  assert.equal(decision.start, false)
})

const JOBS: readonly AutoPmJob[] = [
  { name: 'first', prompt: 'do the first thing', describe: 'doing the first thing' },
  { name: 'second', prompt: 'do the second thing', describe: 'doing the second thing' },
]

/**
 * A fake `agent-data` branch (#1774): a list of commits, each written by an agent or a person
 * (a move) or by a daemon (not one). What the loop reads of it is the head and how many moves
 * lie between two heads — the two things the daemon reads off the real branch with git.
 */
function fakeBranch() {
  const commits: { sha: string; foreign: boolean }[] = [{ sha: 'h0', foreign: true }]
  const at = (sha: string) => commits.findIndex(c => c.sha === sha)
  return {
    get head(): string {
      return commits[commits.length - 1]!.sha
    },
    /** Someone queued an entry, an agent claimed or closed a ticket. */
    move(): string {
      commits.push({ sha: `h${commits.length}`, foreign: true })
      return this.head
    },
    /** The daemon recorded a run, took a lock, minted a claim. */
    record(): string {
      commits.push({ sha: `h${commits.length}`, foreign: false })
      return this.head
    },
    foreignBetween(from: string, to: string): number {
      return commits.slice(at(from) + 1, at(to) + 1).filter(c => c.foreign).length
    },
  }
}

/** A loop wired to one idle project, with every reading overridable per test. */
function harness(overrides: Partial<AutoPmDeps> = {}) {
  const project: AutoPmProject = { id: 'p1', path: '/repo' }
  const branch = fakeBranch()
  const started: string[] = []
  const ran: string[] = []
  const logs: string[] = []
  const deps: AutoPmDeps = {
    projects: async () => [project],
    jobs: JOBS,
    enabled: async () => true,
    dataHead: async () => branch.head,
    foreignCommits: async (_p, from, to) => branch.foreignBetween(from, to),
    // Pinned at one so every test written before #1204 keeps asserting against the behaviour it
    // was written for; the fan-out tests set it explicitly.
    concurrency: async () => 1,
    activeAgents: () => [],
    quota: async () => status(1),
    start: async (p, job) => {
      started.push(p.id)
      ran.push(job.name)
      return `run-${ran.length}`
    },
    settled: async () => ({ settled: true }),
    log: message => logs.push(message),
    now: () => T0,
    ...overrides,
  }
  return { loop: startAutoPm(deps), branch, started, ran, logs }
}

test('startAutoPm gives the rotation its start-up turn on an idle project (#685/#1774)', async () => {
  // The first look remembers where the branch stands; the rotation's turn is what a daemon
  // started with the setting already on has always taken.
  const { loop, started, ran } = harness()
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, ['p1'])
  assert.deepEqual(ran, ['first'])
})

test('startAutoPm starts nothing while the preference is off (#685)', async () => {
  const { loop, started } = harness({ enabled: async () => false })
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, [])
})

test('an on-demand tick sweeps with the preference off: the click is the ask (#1210)', async () => {
  const { loop, started } = harness({ enabled: async () => false })
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(started, ['p1'])
  // The report still says where the box stood, beside what the asked-for sweep did.
  const report = loop.report()
  assert.equal(report.enabled, false)
  assert.equal(report.outcomes[0]?.started, true)
})

test('on demand skips the master switch and the cooldown: every other stand-down still holds (#1210/#1642)', async () => {
  const { loop, started } = harness({ enabled: async () => false, activeAgents: () => ['run-live (pid 111)'] })
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(started, [])
  assert.match(loop.report().outcomes[0]?.message ?? '', /already going/)
})

test('a Run now right after a run starts anyway: the cooldown is for work nobody asked for (#1642)', async () => {
  // Same two ticks as the #685 double-up test below, the second one a click. The sweep's own
  // cooldown held the button for half an hour after any run, and the card said so in small
  // text under the fold — a button that did nothing, to anyone who clicked and looked away.
  const { loop, started } = harness()
  await loop.tick()
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(started, ['p1', 'p1'])
})

test('startAutoPm does not start a second rotation run for the same project (#685)', async () => {
  // The cooldown is what paces the rotation on an idle project.
  const { loop, started } = harness()
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, ['p1'])
})

test('startAutoPm re-arms when the start was refused (#685)', async () => {
  // A refused start spent nothing, so holding the cooldown would strand the project.
  let attempts = 0
  const { loop } = harness({
    start: async () => {
      attempts++
      return attempts > 1 ? `run-${attempts}` : undefined
    },
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.equal(attempts, 2)
})

test('AUTO_PM_JOBS imports, triages, then plans (#773/#891/#892/#1334)', () => {
  // Importing leads: it is the only job that can add a ticket none of the others have seen, so a
  // rotation without it eventually triages and plans a set that nothing ever refills (#1334).
  // Then cheapest-and-readiest: the cheap tickets, the significant ones, and planning last — the
  // priciest turn, and the one whose output every earlier job consumes.
  assert.deepEqual(AUTO_PM_JOBS.map(j => j.name), [
    'update-tickets',
    'triage-quick',
    'triage-consensual',
    'plan-tickets',
  ])
})

test('the rotation is the schedule the triage presets asked for (#891/#892)', () => {
  // #891/#892 both say "with a cron job regularly firing this preset". The rotation already
  // fires after every run that found nothing queued, so no separate scheduler exists — unlike
  // the maintenance sweep (#882), which needs a calendar key because it would never come due.
  const names = AUTO_PM_JOBS.map(j => j.name)
  assert.ok(names.includes('triage-quick'), 'quick triage must be in the rotation')
  assert.ok(names.includes('triage-consensual'), 'consensual triage must be in the rotation')
  // The gated sibling (#698) must never be: it ends in <AWAIT> and would park an agent forever.
  assert.equal(names.includes('suggest-tickets-to-work-on'), false)
  for (const job of AUTO_PM_JOBS) {
    assert.equal(job.prompt.includes('<AWAIT>'), false, `${job.name} must not wait on a human`)
  }
})

test('startAutoPm walks the job cycle across idle moments (#773)', async () => {
  // The cooldown normally spaces these out; zero it so one test can see the whole rotation. Each
  // run settles without moving the branch, which is what hands the rotation its next turn.
  const { loop, ran } = harness({ cooldownMs: 0 })
  await loop.tick()
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first', 'second', 'first'])
})

test('startAutoPm retries the same job when the start was refused (#773)', async () => {
  // Advancing on a refusal would silently skip a job nobody ever ran.
  const ran: string[] = []
  let attempts = 0
  const { loop } = harness({
    cooldownMs: 0,
    start: async (_p, job) => {
      attempts++
      if (attempts === 1) return undefined
      ran.push(job.name)
      return `run-${attempts}`
    },
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
})

test('a finished run is asked about exactly once (#852)', async () => {
  const asked: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    settled: async (_p, { agentId }) => {
      asked.push(agentId)
      return { settled: true }
    },
  })
  await loop.tick()
  await loop.tick()
  await loop.tick()
  // Each tick starts a fresh agent and settles the previous one, so every agent is asked about
  // exactly once. A settled agent being asked twice is the leak this guards.
  assert.deepEqual(asked, [...new Set(asked)])
  assert.deepEqual(asked, ['run-1', 'run-2'])
  assert.deepEqual(ran, ['first', 'second', 'first'])
})

test('a run still going is left pending, and the rotation waits for it (#852/#1774)', async () => {
  const { loop, ran } = harness({ cooldownMs: 0, settled: async () => ({ settled: false }) })
  await loop.tick() // starts run-1
  await loop.tick() // run-1 unsettled: its ending is what earns the next turn, so nothing starts
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
  assert.equal(loop.report().outcomes[0]?.message, 'nothing moved on the agent-data branch since the last run')
})

// #1774: the trigger. The daemon reads no queue; it reads the head of the `agent-data` branch and
// starts the queued work when the branch moved by a commit no daemon wrote.

test('the first look remembers the head and starts nothing on the queued work (#1774)', async () => {
  // A daemon that just started knows nothing about what moved while it was down; the heartbeat
  // is the belt for that. With no rotation wired, the first look starts nothing at all.
  const { loop, ran } = harness({ jobs: [] })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(loop.report().outcomes[0]?.message, 'there is no job to run')
})

test('a commit no daemon wrote starts the queued work, once (#1774)', async () => {
  const { loop, branch, ran } = harness({ jobs: [] })
  await loop.tick()
  branch.move()
  await loop.tick()
  assert.deepEqual(ran, [AUTO_PM_WORK_JOB.name])
  // The move is spent: the next look, with the run settled and nothing new, starts nothing.
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_WORK_JOB.name])
})

test("a commit the daemon wrote is not a move: a run's record must not start the next run (#1774)", async () => {
  const { loop, branch, ran } = harness({ jobs: [] })
  await loop.tick()
  branch.record()
  await loop.tick()
  branch.record()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
})

test('the chain: the run\'s own commits start the next run as it ends, and an empty run stops it (#1774)', async () => {
  // Three queued tasks, one agent at a time. Each run claims and closes a ticket — commits no
  // daemon wrote — so the branch has moved by the time the run ends, and the daemon fires again.
  // The fourth run finds nothing and writes nothing, and the chain ends there.
  let running: string[] = []
  let ended = new Set<string>()
  const { loop, branch, ran } = harness({
    jobs: [],
    activeAgents: () => running,
    settled: async (_p, { agentId }) => ({ settled: ended.has(agentId) }),
    start: async (_p, job) => {
      ran.push(job.name)
      running = [`run-${ran.length} (pid 1)`]
      return `run-${ran.length}`
    },
  })
  await loop.tick() // remembers the head
  branch.move() // someone queued three tasks
  await loop.tick() // run-1 starts
  assert.equal(ran.length, 1)
  branch.move() // run-1 claims its ticket
  await loop.tick() // the cap holds: one at a time
  assert.equal(ran.length, 1)
  assert.match(loop.report().outcomes[0]?.message ?? '', /already going/)
  branch.move() // run-1 closes the ticket and marks the entry done
  running = []
  ended = new Set(['run-1'])
  await loop.tick() // run-1 settled, the branch moved meanwhile: run-2 starts
  assert.equal(ran.length, 2)
  branch.move()
  running = []
  ended = new Set(['run-1', 'run-2'])
  await loop.tick() // run-3
  assert.equal(ran.length, 3)
  branch.move()
  running = []
  ended = new Set(['run-1', 'run-2', 'run-3'])
  await loop.tick() // run-4: finds nothing queued
  assert.equal(ran.length, 4)
  running = []
  ended = new Set(['run-1', 'run-2', 'run-3', 'run-4'])
  await loop.tick() // run-4 settled and nothing moved: the chain stops
  await loop.tick()
  loop.stop()
  assert.equal(ran.length, 4)
  assert.equal(loop.report().outcomes[0]?.message, 'there is no job to run')
})

test('after a run that moved nothing the rotation gets the turn; a move takes it back (#1774)', async () => {
  const { loop, branch, ran } = harness({ cooldownMs: 0 })
  await loop.tick() // the start-up turn: 'first'
  await loop.tick() // 'first' settled without a move: the queue wants refilling, 'second'
  branch.move() // 'second' queued something
  await loop.tick() // the queued work
  await loop.tick() // it settled without a move: the rotation resumes where it left off
  loop.stop()
  assert.deepEqual(ran, ['first', 'second', AUTO_PM_WORK_JOB.name, 'first'])
})

test('a move is not paced by the cooldown; the rotation is (#1774)', async () => {
  let now = T0
  const { loop, branch, ran } = harness({ now: () => now, concurrency: async () => 2 })
  await loop.tick() // the rotation's start-up turn arms the cooldown
  now += 60_000
  branch.move()
  await loop.tick() // a minute later: the queued work starts regardless
  assert.deepEqual(ran, ['first', AUTO_PM_WORK_JOB.name])
  now += 60_000
  await loop.tick() // both settled without a move: the rotation is owed a turn, and waits
  assert.deepEqual(ran, ['first', AUTO_PM_WORK_JOB.name])
  assert.equal(loop.report().outcomes[0]?.message, 'a run was started for this project a moment ago')
  now += 31 * 60_000
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first', AUTO_PM_WORK_JOB.name, 'second'])
})

test('the heartbeat starts the queued work once a day when nothing moved (#1774)', async () => {
  let now = T0
  const { loop, ran } = harness({ jobs: [], heartbeatMs: 1_000, now: () => now })
  await loop.tick()
  now += 500
  await loop.tick()
  assert.deepEqual(ran, [])
  now += 500
  await loop.tick()
  assert.deepEqual(ran, [AUTO_PM_WORK_JOB.name])
  now += 500
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_WORK_JOB.name], 'the next heartbeat is a day after the last start')
})

test("the queued work's Run now starts an agent without a move, or says why not (#1204/#1774)", async () => {
  const { loop, ran } = harness({ jobs: [] })
  await loop.tick()
  await loop.tick({ onDemand: true, only: 'work' })
  assert.deepEqual(ran, [AUTO_PM_WORK_JOB.name])

  const off = harness({ jobs: [], optedOut: async () => [AUTO_PM_WORK_JOB.name] })
  await off.loop.tick({ onDemand: true, only: 'work' })
  off.loop.stop()
  loop.stop()
  assert.deepEqual(off.ran, [])
  assert.equal(off.loop.report().outcomes[0]?.message, 'the routine that works the queue is switched off')
})

test('a plain Run now starts the queued work when the branch moved, else the rotation (#1210/#1774)', async () => {
  const { loop, branch, ran } = harness({ cooldownMs: 0 })
  await loop.tick()
  branch.move()
  await loop.tick({ onDemand: true })
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(ran, ['first', AUTO_PM_WORK_JOB.name, 'second'])
})

test('a move while the queued-work routine is switched off is the rotation\'s turn (#1209/#1432/#1774)', async () => {
  // #1209 means "do not work the queue", and the rotation does not work it: triage and planning
  // put entries on it. Standing down would make every inventing routine unreachable.
  const { loop, branch, ran, logs } = harness({ cooldownMs: 0, optedOut: async () => [AUTO_PM_WORK_JOB.name] })
  await loop.tick()
  branch.move()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first', 'second'])
  assert.ok(!logs.some(line => line.includes(AUTO_PM_WORK_JOB.prompt)), 'and nothing worked the queue')
})

test('a branch that cannot be read stands the project down (#1774)', async () => {
  const { loop, ran } = harness({ dataHead: async () => undefined })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
  assert.match(loop.report().outcomes[0]?.message ?? '', /agent-data branch could not be read/)
})

test('a stand-down is logged when it is news, not once a minute (#1774)', async () => {
  const { loop, logs } = harness({ jobs: [] })
  await loop.tick()
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(logs, ['[framework] auto PM: standing down for /repo — there is no job to run'])
  // The report says it every time: the panel reads the last sweep, not the log.
  assert.equal(loop.report().outcomes[0]?.message, 'there is no job to run')
})

test('AUTO_PM_WORK_JOB fires the routine skill by its slash command, and lands its own PRs (#1216/#1774)', () => {
  // The prompt is the skill's name as a slash command; the agent's harness expands it. The skill
  // file ships in the routines package, and only a person or the daemon may invoke it.
  assert.equal(AUTO_PM_WORK_JOB.prompt, `/${WORK_QUEUE_SKILL_NAME}`)
  assert.equal(AUTO_PM_WORK_JOB.works, true)
  const routines = dirname(createRequire(import.meta.url).resolve('@gemstack/routines/package.json'))
  const skill = readFileSync(join(routines, 'skills', WORK_QUEUE_SKILL_NAME, 'SKILL.md'), 'utf8')
  assert.match(skill, new RegExp(`^---\\nname: ${WORK_QUEUE_SKILL_NAME}\\n`))
  assert.match(skill, /\ndisable-model-invocation: true\n/)
  // What the agent is told: one task, commit but do not push, committed counts as published,
  // release what it holds, say so and stop when nothing is queued.
  assert.match(skill, /Take one queued task only/)
  assert.match(skill, /do not push/)
  assert.match(skill, /committed counts as published/)
  assert.match(skill, /If nothing is queued, say so and stop/)
  // The queued work implements entries whose triage a human could have vetoed, so its review
  // happened before the agent. Every other job writes tickets/plans and has nothing to merge.
  assert.equal(AUTO_PM_WORK_JOB.autoMerge, true)
  for (const job of [...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB]) {
    assert.equal(job.autoMerge, undefined, `${job.name} must not auto-merge`)
    assert.notEqual(job.works, true, `${job.name} must not claim to work the queue`)
  }
})

test('AUTO_PM_MAINTENANCE_JOB fires the [Maintenance] preset over the whole codebase (#882)', () => {
  // It renders with no session, so the preset's own default is what scopes it. A sweep that
  // silently scoped itself to one session would miss the pre-existing history it exists for.
  assert.equal(AUTO_PM_MAINTENANCE_JOB.name, 'maintenance')
  assert.match(AUTO_PM_MAINTENANCE_JOB.prompt, /entire codebase/)
  assert.doesNotMatch(AUTO_PM_MAINTENANCE_JOB.prompt, /\$\{\{/)
})

test('a due project is swept before the rotation gets a turn (#882)', async () => {
  const { loop, ran } = harness({ cooldownMs: 0, maintenanceDue: async () => true })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_MAINTENANCE_JOB.name])
})

test('a project that is not due keeps doing the rotation (#882)', async () => {
  const { loop, ran } = harness({ cooldownMs: 0, maintenanceDue: async () => false })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first', 'second'])
})

test('a sweep does not cost the rotation its turn (#882)', async () => {
  // The sweep is paced by the calendar, not the cycle. If it advanced the rotation, the job it
  // borrowed the tick from would be skipped and never run.
  let due = true
  const { loop, ran } = harness({
    cooldownMs: 0,
    maintenanceDue: async () => due,
    recordMaintenance: async () => {
      due = false
    },
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_MAINTENANCE_JOB.name, 'first'])
})

test('a sweep is stamped only when the run actually started (#882)', async () => {
  // Stamping a refused sweep would postpone it a whole interval for an agent that never happened.
  const stamped: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    maintenanceDue: async () => true,
    recordMaintenance: async project => {
      stamped.push(project.id)
    },
    start: async () => undefined,
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(stamped, [])
})

test('a branch that moved is worked rather than swept (#882/#1774)', async () => {
  // A project with queued work has plenty to do; sweeping would only pile more on.
  const { loop, branch, ran } = harness({ cooldownMs: 0, maintenanceDue: async () => true, settled: async () => ({ settled: false }) })
  await loop.tick() // the start-up turn goes to the due sweep
  branch.move()
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_MAINTENANCE_JOB.name, AUTO_PM_WORK_JOB.name])
})

test('a sweep stopped mid-flight starts nothing (#983)', async () => {
  // stop() used to only clear the timer, so a tick already inside its per-project loop kept
  // awaiting (git calls, the branch read) and then spawned an agent anyway. By then the daemon has
  // quiesced and cleared its live-agent map, so that agent is tracked by nobody: an orphan holding a
  // worktree, and quota spent on an agent nobody will ever see.
  const both: AutoPmProject[] = [
    { id: 'p1', path: '/repo' },
    { id: 'p2', path: '/other' },
  ]
  let loop!: AutoPmLoop
  const h = harness({
    projects: async () => both,
    // The daemon shutting down while the sweep sits between its readings and the spawn.
    quota: async () => {
      loop.stop()
      return status(1)
    },
  })
  loop = h.loop
  await loop.tick()
  // p2 neither: stopping is a verdict on the whole sweep, not on one project.
  assert.deepEqual(h.started, [])
})

test('a stopped sweep does not tick again (#983)', async () => {
  const { loop, started } = harness()
  loop.stop()
  await loop.tick()
  assert.deepEqual(started, [])
})

test('an unreadable sweep schedule falls back to the rotation (#882)', async () => {
  // Treating "cannot tell" as due would sweep the codebase on every single tick.
  const { loop, ran } = harness({
    cooldownMs: 0,
    maintenanceDue: async () => {
      throw new Error('no such file')
    },
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
})

test('the report names what a sweep started (#1161)', async () => {
  const { loop } = harness()
  await loop.tick()
  loop.stop()
  const report = loop.report()
  assert.equal(report.enabled, true)
  assert.equal(report.sweptAt, T0)
  assert.deepEqual(report.outcomes, [
    { projectId: 'p1', path: '/repo', started: true, message: 'doing the first thing' },
  ])
})

test('the report carries the reason a sweep stood down (#1161)', async () => {
  // The whole point: standing down for a reason must not look like quietly working. The reason
  // was already logged, but the log is the daemon's stdout and the toggle is in a browser.
  const { loop } = harness({ activeAgents: () => ['run-a (pid 111)', 'run-b (pid 222)'] })
  await loop.tick()
  loop.stop()
  const [outcome] = loop.report().outcomes
  assert.equal(outcome?.started, false)
  assert.match(outcome?.message ?? '', /already going/)
})

test('the report says so when the preference is off (#1161)', async () => {
  // Distinguishable from "on, and standing down": the panel hides the line entirely for off,
  // and an off sweep considers no project, so it can have no per-project reason either.
  const { loop } = harness({ enabled: async () => false })
  await loop.tick()
  loop.stop()
  const report = loop.report()
  assert.equal(report.enabled, false)
  assert.deepEqual(report.outcomes, [])
})

test('the report offers a next sweep before the first one has run (#1161)', () => {
  // The panel reads `sweptAt === undefined` as "checking…", so it must never read as an idle sweep.
  const { loop } = harness({ intervalMs: 60_000 })
  const report = loop.report()
  loop.stop()
  assert.equal(report.sweptAt, undefined)
  assert.equal(report.enabled, undefined)
  assert.equal(report.nextSweepAt, T0 + 60_000)
})

test('an out-of-band tick does not skew the next sweep (#1161)', async () => {
  // Waking the loop when the box is ticked must not push the interval it is not driving.
  const { loop } = harness({ intervalMs: 60_000 })
  await loop.tick()
  loop.stop()
  assert.equal(loop.report().nextSweepAt, T0 + 60_000)
})

/** The catalog key whose preset a routine fires, found by that preset's run-kind name. */
function presetKey(name: string): PresetKey {
  const key = (Object.keys(presets) as PresetKey[]).find(k => presets[k].name === name)
  if (!key) throw new Error(`no preset is named ${name}`)
  return key
}

test('AUTO_PM_ROUTINES is every job the sweep can fire, once each (#1159)', () => {
  // The dashboard lists this rather than a copy of it, so a job added to the rotation reaches the
  // screen without anyone remembering to put it there too.
  const expected = [AUTO_PM_WORK_JOB, ...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB]
  assert.deepEqual(AUTO_PM_ROUTINES.map(j => j.name), expected.map(j => j.name))
  assert.equal(new Set(AUTO_PM_ROUTINES.map(j => j.name)).size, AUTO_PM_ROUTINES.length)
  // The queued work leads: it is what the sweep does whenever the branch moved, and the only
  // routine that turns a queue entry into commits.
  assert.equal(AUTO_PM_ROUTINES[0]?.name, AUTO_PM_WORK_JOB.name)
})

test('every routine carries a label and a prompt, so a list of them is runnable (#1159)', () => {
  for (const job of [...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB]) {
    assert.equal(job.label, presets[presetKey(job.name)].label, `${job.name} must be labelled by its preset`)
  }
  for (const job of AUTO_PM_ROUTINES) {
    assert.ok(job.label, `${job.name} must carry a label`)
    assert.ok(job.prompt.trim().length > 0, `${job.name} must carry a prompt`)
    // The prompt travels to the browser and is started verbatim, so nothing may be left unrendered.
    assert.doesNotMatch(job.prompt, /\$\{\{/, `${job.name} must ship a rendered prompt`)
  }
})

test('only the maintenance sweep describes itself; the rest are just their label', () => {
  // "Maintenance" names the preset rather than the work, so its row and log line keep the
  // sentence; the other routines' labels already say what they do.
  assert.equal(AUTO_PM_MAINTENANCE_JOB.describe, 'sweeping the codebase for maintenance work')
  for (const job of [AUTO_PM_WORK_JOB, ...AUTO_PM_JOBS]) {
    assert.equal(job.describe, undefined, `${job.name} must not say its label twice`)
  }
})

test('a routine the user unticked is left out of the rotation (#1209)', async () => {
  const { loop, ran } = harness({ cooldownMs: 0, optedOut: async () => ['first'] })
  await loop.tick()
  await loop.tick()
  loop.stop()
  // Filtered, not skipped at the index: with 'first' off, 'second' comes round every turn rather
  // than every other one landing on a job that cannot run.
  assert.deepEqual(ran, ['second', 'second'])
})

test('the maintenance sweep stays out while the branch has moved, work routine on or off (#882/#1432/#1774)', async () => {
  let due = true
  const { loop, branch, ran } = harness({
    cooldownMs: 0,
    optedOut: async () => [AUTO_PM_WORK_JOB.name],
    maintenanceDue: async () => due,
    recordMaintenance: async () => {
      due = false
    },
  })
  await loop.tick() // the start-up turn: a due sweep
  branch.move()
  await loop.tick() // a move with the work routine off is the rotation's turn
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_MAINTENANCE_JOB.name, 'first'])
})

test('an unticked maintenance routine leaves its calendar alone (#1209)', async () => {
  // Not merely skipped: stamping it would tick the schedule past while the box was off, so the
  // sweep would not come due when it is ticked back on.
  const stamped: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    maintenanceDue: async () => true,
    recordMaintenance: async project => {
      stamped.push(project.id)
    },
    optedOut: async () => [AUTO_PM_MAINTENANCE_JOB.name],
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(stamped, [])
  assert.deepEqual(ran, ['first'])
})

test('unticking every routine starts nothing, and says which kind of nothing it is (#1209)', async () => {
  const { loop, ran } = harness({
    cooldownMs: 0,
    optedOut: async () => AUTO_PM_ROUTINES.map(job => job.name).concat(JOBS.map(job => job.name)),
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(loop.report().outcomes[0]?.message, 'every routine that makes new work is switched off')
})

test('an unreadable opt-out list means none, never all (#1209)', async () => {
  // Failing the other way would let one bad read switch the whole schedule off silently.
  const { loop, ran } = harness({
    cooldownMs: 0,
    optedOut: async () => {
      throw new Error('no registry')
    },
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
})

// #1646: the live-agent reading names what it counted. The one time it came out one too high, the
// Agents panel showed nothing running and the number could not be questioned — the run holding the
// slot was a process that had outlived its finished run, visible only to the daemon's own table.

test('a cap stand-down names the runs holding the slots (#1646)', () => {
  const capped = autoPmDecision({ ...IDLE, activeAgents: 2, concurrency: 2, running: ['run-a (pid 111)', 'run-b (pid 222)'] })
  assert.equal(capped.start, false)
  assert.equal(
    capped.start === false ? capped.reason : '',
    '2 runs are already going (run-a (pid 111), run-b (pid 222)), and the routine keeps at most 2 at once',
  )
  // Unnamed stays as it was: the count alone is still a complete sentence.
  const unnamed = autoPmDecision({ ...IDLE, activeAgents: 1, concurrency: 1 })
  assert.equal(unnamed.start === false ? unnamed.reason : '', '1 run is already going')
})

// #1327: [Plan tickets] fans out — the one rotation job that writes per-ticket sibling files
// rather than the shared queue document, so agents pinned one ticket each do disjoint work. The
// PENDING locks are what make the batch safe beyond this process's memory, so no locks means no
// fan-out.

const PLAN_JOB: AutoPmJob = { name: 'plan', prompt: 'Plan every ticket that has no plan yet.', fansOut: true }

test('a fansOut job fans out to the concurrency, one locked ticket per agent (#1327)', async () => {
  const prompts: string[] = []
  const lockCalls: PlanAssignment[][] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 3,
    planCandidates: async () => ['a.md', 'b.md', 'c.md', 'd.md'],
    lockPlans: async (_p, assignments) => {
      lockCalls.push([...assignments])
      return assignments
    },
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 3, 'the batch stops at the concurrency, not at the candidate count')
  // Pinned to *different* tickets, in the candidates' own most-important-first order.
  assert.match(prompts[0]!, /tickets\/a\.md/)
  assert.match(prompts[1]!, /tickets\/b\.md/)
  assert.match(prompts[2]!, /tickets\/c\.md/)
  // The whole batch was locked in one call, before any agent started, and each agent's prompt
  // names the id its own lock carries.
  assert.equal(lockCalls.length, 1)
  assert.equal(lockCalls[0]!.length, 3)
  assert.equal(new Set(lockCalls[0]!.map(a => a.agentId)).size, 3)
  // The ids are minted a millisecond apart from the sweep's clock (#1748), so a batch stays distinct.
  assert.match(lockCalls[0]![0]!.agentId, /^2026-07-20T12-00-00-000Z$/)
  assert.match(prompts[0]!, /`tickets show a\.md` names you as its holder/)
})

test('a fan-out that came out short says what it was short by, by name (#1646)', async () => {
  // Three allowed, one slot held by a run the sweep did not start: two go out, and the card says
  // alongside whom, so a held slot nobody can see on the dashboard is named rather than silent.
  const { loop, ran } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 3,
    activeAgents: () => ['2026-08-22T22-06-41-065Z (pid 4242)'],
    planCandidates: async () => ['a.md', 'b.md', 'c.md'],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick()
  loop.stop()
  assert.equal(ran.length, 2, 'the batch is the cap minus the held slot')
  assert.equal(
    loop.report().outcomes[0]?.message,
    'started 2 agents alongside 1 already going (2026-08-22T22-06-41-065Z (pid 4242)): planning "a.md"; planning "b.md"',
  )
})

test('an unreadable concurrency falls back to the default rather than to one (#1204)', async () => {
  // Same polarity as the opt-out list: one bad read must not quietly shrink the routine.
  const { loop, started } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => Promise.reject(new Error('no registry')),
    planCandidates: async () => ['a.md', 'b.md', 'c.md'],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, DEFAULT_AUTO_PM_CONCURRENCY)
})

test('a refusal ends the batch, so the refused work is retried rather than skipped (#1204)', async () => {
  // Whatever refused this start is not going to take the next one a moment later.
  let attempts = 0
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 4,
    planCandidates: async () => ['a.md', 'b.md', 'c.md', 'd.md'],
    lockPlans: async (_p, assignments) => assignments,
    start: async () => {
      attempts++
      return attempts === 1 ? 'run-1' : undefined
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(attempts, 2, 'one start took, the second was refused, and the batch stopped there')
})

// #1204: Run now on the planning routine reaches the same fan-out the daemon uses. It used to be
// a plain single start, so the concurrency setting was the one thing that click ignored.

test("a plan-only sweep fans out the planning routine, one locked ticket per agent (#1204)", async () => {
  const prompts: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 3,
    planCandidates: async () => ['a.md', 'b.md', 'c.md'],
    lockPlans: async (_p, assignments) => assignments,
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.equal(prompts.length, 3, 'the click spends the concurrency, not one agent')
  assert.match(prompts[0]!, /tickets\/a\.md/)
  assert.match(prompts[2]!, /tickets\/c\.md/)
})

test("a plan-only sweep plans instead of working the queue, however much the branch moved (#1204/#1774)", async () => {
  const prompts: string[] = []
  const { loop, branch, ran } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 2,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  branch.move()
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(prompts.filter(p => p !== AUTO_PM_WORK_JOB.prompt).length, prompts.length, 'no agent was sent to the queue: the click asked for planning')
  assert.match(prompts[prompts.length - 1]!, /tickets\/a\.md/)
})

test("a plan-only sweep stands down when the planning routine is switched off (#1204)", async () => {
  const { loop, ran, logs } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    optedOut: async () => ['plan'],
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.deepEqual(ran, [], 'an unticked box is not overridden by the click')
  assert.ok(logs.some(line => line.includes('the planning routine is switched off')))
})

test("a plan-only sweep visits only the project the card picked (#1204)", async () => {
  const { loop, started } = harness({
    projects: async () => [
      { id: 'p1', path: '/one' },
      { id: 'p2', path: '/two' },
    ],
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p2' })
  loop.stop()
  assert.deepEqual(started, ['p2'], 'the other project is not swept by a click that named one')
})

test('a plan click does not cost the maintenance sweep its turn either', async () => {
  // Same rule as the rotation index above: the click borrows the tick for the routine it named,
  // so the due sweep never ran — and stamping its calendar would postpone it a whole interval.
  const stamped: string[] = []
  const { loop, ran } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    maintenanceDue: async () => true,
    recordMaintenance: async project => void stamped.push(project.id),
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.deepEqual(ran, ['plan'])
  assert.deepEqual(stamped, [], 'the sweep it did not run keeps its schedule')
})

test("a plan click does not cost the rotation its turn (#1204)", async () => {
  // The rotation is mid-cycle; a click that borrows the tick for a routine it named must leave
  // the cycle where it was, the same way a due maintenance sweep does.
  const other: AutoPmJob = { name: 'triage', prompt: 'Triage.' }
  const { loop, ran } = harness({
    jobs: [other, PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['plan', 'triage'], 'the scheduled tick still gets the rotation job it was owed')
})

test('only the tickets the lock actually claimed go out (#1327)', async () => {
  // A lost race — b.md's sibling appeared between the enumeration and the lock — costs that one
  // agent, not the batch.
  const prompts: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 3,
    planCandidates: async () => ['a.md', 'b.md', 'c.md'],
    lockPlans: async (_p, assignments) => assignments.filter(a => a.ticket !== 'b.md'),
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 2)
  assert.ok(prompts.every(prompt => !/tickets\/b\.md/.test(prompt)))
})

test('a lock that claimed nothing falls back to the stock single agent (#1327)', async () => {
  // One unpinned agent is the pre-#1327 behaviour and needs no lock to be safe; fanning out
  // unguarded is exactly the double-work the locks exist to prevent.
  const prompts: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 3,
    planCandidates: async () => ['a.md', 'b.md'],
    lockPlans: async () => [],
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 1)
  assert.equal(prompts[0], PLAN_JOB.prompt)
})

test('without the lock seam the job stays one per tick however high the concurrency (#1327)', async () => {
  const { loop, started } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 5,
    planCandidates: async () => ['a.md', 'b.md', 'c.md'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 1)
})

test('a ticket a live plan run is pinned to is not offered again (#1327)', async () => {
  // The lock files also guard this on disk, but the in-memory pin answers first and without
  // re-reading anything. A second agent goes out on a click: the rotation itself waits for the
  // first to end.
  const prompts: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 2,
    planCandidates: async () => ['a.md', 'b.md'],
    lockPlans: async (_p, assignments) => assignments.slice(0, 1),
    settled: async () => ({ settled: false }), // still in flight
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.equal(prompts.length, 2)
  assert.match(prompts[0]!, /tickets\/a\.md/)
  assert.match(prompts[1]!, /tickets\/b\.md/)
})

test('nothing left to plan advances the rotation rather than retrying it forever (#1327)', async () => {
  // "Every ticket has a plan" is this job's work being done, not a refusal: the next
  // tick must land on the next job, and the tick must not spend a cooldown on having started
  // nothing.
  const { loop, ran } = harness({
    jobs: [PLAN_JOB, { name: 'second', prompt: 'do the second thing' }],
    cooldownMs: 0,
    planCandidates: async () => [],
    lockPlans: async (_p, assignments) => assignments,
  })
  await loop.tick()
  assert.match(loop.report().outcomes[0]?.message ?? '', /already has a plan/)
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['second'])
})

test('pinnedPlanJob appends the pin, so the preset keeps its own rules verbatim (#1327)', () => {
  const pinned = pinnedPlanJob(PLAN_JOB, { ticket: '2026-07-25_x.md', agentId: 'plan-7-0' })
  // Appended, not spliced: the maintainer owns the preset's wording, and a rewrite must not be
  // able to silently lose the pin.
  assert.ok(pinned.prompt.startsWith(PLAN_JOB.prompt))
  assert.match(pinned.prompt, /exactly one ticket, `tickets\/2026-07-25_x\.md`/)
  assert.match(pinned.prompt, /`tickets show 2026-07-25_x\.md` names you as its holder/)
  // The lock has no timer since #1420, so the agent is told to lift it once the plan is written.
  assert.match(pinned.prompt, /`tickets put 2026-07-25_x\.plan\.md`, then lift your claim with `tickets release 2026-07-25_x\.md`/)
  assert.equal(pinned.ticket, '2026-07-25_x.md')
})

test('the catalog job that fans out is [Plan tickets], and only it (#1327)', () => {
  assert.deepEqual(
    AUTO_PM_JOBS.filter(job => job.fansOut).map(job => job.name),
    [presets.planTickets.name],
  )
})

test('the rotation stays one run per tick however high the concurrency (#1204)', async () => {
  // Deliberate: every rotation job rewrites the whole queue file from the same fork point, so two
  // at once would have the later promotion revert the earlier one's entries. Only planning, which
  // writes one ticket's own files, is safe to run several of at a time.
  const { loop, ran } = harness({ cooldownMs: 0, concurrency: async () => 5 })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
})

// #1583: the one claim the sweep can *know* is dead. A plan agent that settles with `no-commits`
// never opens the PR whose merge deletes its `.lock.md`, so without this the planning livelocks on
// the dead claim — the next sweep re-offers the ticket, the lock skips it, and the batch empties,
// forever, until a human clicks Release.

test('a claim whose run settled with nothing to hand off is released (#1583)', async () => {
  const released: PlanAssignment[] = []
  const lockCalls: PlanAssignment[][] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => {
      lockCalls.push([...assignments])
      return assignments
    },
    settled: async () => ({ settled: true, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick() // mints the claim and starts the plan agent
  await loop.tick() // the run has settled `no-commits`: the exact minted claim is freed
  loop.stop()
  assert.deepEqual(released, [lockCalls[0]![0]])
})

test('a sweep that catches the end-before-handoff gap holds the claim and still releases (#1583)', async () => {
  // `end` lands before the handoff event, so a sweep can observe a finished run whose ending is
  // not written yet. Settling there would drop the claim with the ending unread — the release
  // would be missed for good — so the agent is held pending until the epilogue reports.
  const released: PlanAssignment[] = []
  let ending: { handoffPending?: boolean; handoffSkip?: 'no-commits' } = { handoffPending: true }
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    settled: async () => ({ settled: true, ...ending }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick() // starts the plan agent
  await loop.tick() // mid-epilogue: held, not settled, nothing released
  assert.deepEqual(released, [])
  ending = { handoffSkip: 'no-commits' }
  await loop.tick() // the ending has landed: the claim is freed
  loop.stop()
  assert.equal(released.length, 1)
})

test('the mid-epilogue hold is bounded, so a run that dies there cannot hold its claim forever (#1583)', async () => {
  const released: PlanAssignment[] = []
  const asked: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    settled: async (_p, { agentId }) => {
      asked.push(agentId)
      return { settled: true, handoffPending: true }
    },
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick()
  for (let i = 0; i < 5; i++) await loop.tick()
  loop.stop()
  // Two held sweeps, then the third settles it unread — the pre-#1583 behavior — rather than
  // asking forever about a run that will never answer.
  assert.equal(asked.filter(id => id === 'run-1').length, 3)
  assert.deepEqual(released, [])
})

test('a ticket whose plan agent ended with nothing to hand off is not planned again (#1583)', async () => {
  // Releasing the claim re-opens the work, and a job that deterministically ends commitless
  // would respawn every cooldown forever, burning a quota run per cycle. One attempt per daemon
  // lifetime.
  const prompts: string[] = []
  const released: PlanAssignment[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    settled: async () => ({ settled: true, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick() // spawns the plan agent
  await loop.tick() // settles no-commits: the claim is released and the ticket remembered
  await loop.tick() // the ticket is still open, and deliberately not offered again
  loop.stop()
  assert.equal(prompts.length, 1)
  assert.equal(released.length, 1)
  assert.match(loop.report().outcomes[0]?.message ?? '', /already has a plan, or an agent on the way to one/)
})

test('claims of a batch the start loop never reached are released, not stranded (#1583)', async () => {
  // The batch's locks are committed and pushed before the first spawn; a refused start breaks
  // the loop, and the never-started items' claims have no run that could ever settle them free.
  const released: PlanAssignment[] = []
  const lockCalls: PlanAssignment[][] = []
  let starts = 0
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 2,
    planCandidates: async () => ['a.md', 'b.md'],
    lockPlans: async (_p, assignments) => {
      lockCalls.push([...assignments])
      return assignments
    },
    start: async () => (++starts === 1 ? 'run-1' : undefined), // the second spawn is refused
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(released.length, 1)
  assert.equal(released[0]!.ticket, lockCalls[0]![1]!.ticket)
})

test('a release that could not land is retried next sweep, bounded (#1583)', async () => {
  const attempts: PlanAssignment[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    settled: async () => ({ settled: true, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      attempts.push(claim)
      return attempts.length >= 2 // the first try hits a transient failure, the retry lands
    },
  })
  await loop.tick()
  await loop.tick() // the release fails to commit: the agent is held for a retry
  await loop.tick() // the retry lands
  await loop.tick() // dealt with: no further attempts
  loop.stop()
  assert.equal(attempts.length, 2)
})

test('every other ending leaves the lock to its own lifecycle (#1583)', async () => {
  // A run that published (or whose handoff skipped because its PR already exists) has a PR whose
  // merge deletes the lock; freeing it here would re-open the double-work window the claim closes.
  for (const outcome of [{ settled: true }, { settled: true, handoffSkip: 'already-open' as const }]) {
    const released: PlanAssignment[] = []
    const { loop } = harness({
      jobs: [PLAN_JOB],
      cooldownMs: 0,
      planCandidates: async () => ['a.md'],
      lockPlans: async (_p, assignments) => assignments,
      settled: async () => outcome,
      releaseLock: async (_p, claim) => {
        released.push(claim)
        return true
      },
    })
    await loop.tick()
    await loop.tick()
    loop.stop()
    assert.deepEqual(released, [])
  }
})

// #1659: the routine lock. A triage rewrites the shared queue and may take hours, so the sweep
// takes `routines/<name>.lock.md` on the data branch before the start — the daemon decides, and
// no agent is spent finding out — and gives it back when the run ends, whatever the ending.

const LOCKED_JOB: AutoPmJob = {
  name: 'triage-quick',
  prompt: 'Triage.',
  label: 'Triage quick wins',
  lock: 'triage-quick',
}

/** A lock that behaves like the real one: taken once, standing every later taker down until released. */
function fakeLock(order: string[] = []) {
  let held = false
  const lockRoutine: AutoPmDeps['lockRoutine'] = async (_project, lock) => {
    order.push(`lock:${lock}`)
    if (held) return { ok: false, reason: `${lock} is already running on laptop (since T0)` }
    held = true
    return { ok: true }
  }
  const releaseRoutine: AutoPmDeps['releaseRoutine'] = async (_project, lock) => {
    order.push(`release:${lock}`)
    held = false
    return true
  }
  return { order, lockRoutine, releaseRoutine, isHeld: () => held }
}

test('a locked job takes its lock before it starts, and releases it when the run ends (#1659)', async () => {
  const lock = fakeLock()
  let settled = false
  const { loop } = harness({
    jobs: [LOCKED_JOB],
    cooldownMs: 0,
    lockRoutine: lock.lockRoutine,
    releaseRoutine: lock.releaseRoutine,
    start: async (_project, job) => {
      lock.order.push(`start:${job.name}`)
      return 'run-1'
    },
    settled: async () => ({ settled }),
  })
  await loop.tick()
  assert.deepEqual(lock.order, ['lock:triage-quick', 'start:triage-quick'])
  // Still running: the lock stands, and the rotation waits for the run rather than starting another.
  await loop.tick()
  assert.deepEqual(lock.order, ['lock:triage-quick', 'start:triage-quick'])
  settled = true
  await loop.tick()
  loop.stop()
  // Released on the ending itself — no `no-commits` condition, no PR: a triage never opens one —
  // and the same sweep may take it again.
  assert.deepEqual(lock.order.slice(2), ['release:triage-quick', 'lock:triage-quick', 'start:triage-quick'])
})

test('a held lock stands the job down naming its holder, with no agent started (#1659)', async () => {
  const { loop, ran } = harness({
    jobs: [LOCKED_JOB],
    cooldownMs: 0,
    lockRoutine: async () => ({ ok: false, reason: 'triage-quick is already running on other-machine (since 2026-08-23T10:00:00.000Z)' }),
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(loop.report().outcomes[0]?.started, false)
  assert.equal(loop.report().outcomes[0]?.message, 'triage-quick is already running on other-machine (since 2026-08-23T10:00:00.000Z)')
})

test('a refused start gives the lock back, and a failed release is retried next sweep (#1659)', async () => {
  const releases: string[] = []
  const refused = harness({
    jobs: [LOCKED_JOB],
    cooldownMs: 0,
    lockRoutine: async () => ({ ok: true }),
    releaseRoutine: async (_project, lock) => {
      releases.push(lock)
      return true
    },
    start: async () => undefined,
  })
  await refused.loop.tick()
  refused.loop.stop()
  assert.deepEqual(releases, ['triage-quick'], 'no run will ever release a lock taken for a start that never happened')

  let ok = false
  const lock = fakeLock()
  const flaky = harness({
    jobs: [LOCKED_JOB],
    cooldownMs: 0,
    lockRoutine: lock.lockRoutine,
    releaseRoutine: async (project, name) => (ok ? lock.releaseRoutine!(project, name) : false),
    settled: async () => ({ settled: true }),
  })
  await flaky.loop.tick()
  await flaky.loop.tick()
  assert.deepEqual(flaky.ran, ['triage-quick'], 'the lock still stands while its release has not landed')
  assert.ok(lock.isHeld())
  ok = true
  await flaky.loop.tick()
  flaky.loop.stop()
  assert.deepEqual(flaky.ran, ['triage-quick', 'triage-quick'], 'the retried release lands, and the routine may run again')
})

test('an unlocked job never asks for a lock, and a loop wired without the seam starts unguarded (#1659)', async () => {
  const locks: string[] = []
  const unlocked = harness({
    lockRoutine: async (_project, lock) => {
      locks.push(lock)
      return { ok: true }
    },
  })
  await unlocked.loop.tick()
  unlocked.loop.stop()
  assert.deepEqual(locks, [])
  assert.deepEqual(unlocked.ran, ['first'])

  const unwired = harness({ jobs: [LOCKED_JOB] })
  await unwired.loop.tick()
  unwired.loop.stop()
  assert.deepEqual(unwired.ran, ['triage-quick'])
})

test("a previous daemon's dead locks are released on the project's first sweep only (#1659)", async () => {
  const boots: string[] = []
  const { loop } = harness({
    releaseDeadLocks: async project => {
      boots.push(project.id)
    },
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.deepEqual(boots, ['p1'])
})

// #1643: Run now on a locked routine reaches the same lock-then-start the sweep does. It used to
// be a plain start outside the sweep, which ran unguarded.

test('a sweep narrowed to a locked job takes its lock, then starts exactly one agent (#1643/#1659)', async () => {
  const order: string[] = []
  const { loop } = harness({
    // The rotation is on another job's turn, so a tick that ignored the narrowing would start
    // that one instead — the lock-then-start below is the click's doing, not the cycle's.
    jobs: [{ name: 'update', prompt: 'Update.' }, LOCKED_JOB],
    cooldownMs: 0,
    // Room for three, so a single start is the routine's own shape and not the cap's doing.
    concurrency: async () => 3,
    lockRoutine: async (_project, lock) => {
      order.push(`lock:${lock}`)
      return { ok: true }
    },
    start: async (_project, job) => {
      order.push(`start:${job.name}`)
      return `run-${order.length}`
    },
  })
  await loop.tick({ onDemand: true, only: { lock: 'triage-quick' }, projectId: 'p1' })
  loop.stop()
  assert.deepEqual(order, ['lock:triage-quick', 'start:triage-quick'])
})

test('a switched-off locked routine stands the click down, and so does every other gate (#1643)', async () => {
  const off = harness({ jobs: [LOCKED_JOB], cooldownMs: 0, optedOut: async () => ['triage-quick'] })
  await off.loop.tick({ onDemand: true, only: { lock: 'triage-quick' }, projectId: 'p1' })
  off.loop.stop()
  assert.deepEqual(off.ran, [], 'an unticked box is not overridden by the click')
  assert.equal(off.loop.report().outcomes[0]?.message, 'Triage quick wins is switched off')

  // A lock nothing holds is said as such, not as a setting the user could go and undo.
  const unknown = harness({ jobs: [LOCKED_JOB], cooldownMs: 0 })
  await unknown.loop.tick({ onDemand: true, only: { lock: 'nobody' }, projectId: 'p1' })
  unknown.loop.stop()
  assert.deepEqual(unknown.ran, [])
  assert.equal(unknown.loop.report().outcomes[0]?.message, 'no routine holds the nobody lock')

  // The click skips the master switch and the cooldown, not the cap (#1204/#1642).
  const capped = harness({ jobs: [LOCKED_JOB], cooldownMs: 0, activeAgents: () => ['run-live (pid 111)'] })
  await capped.loop.tick({ onDemand: true, only: { lock: 'triage-quick' }, projectId: 'p1' })
  capped.loop.stop()
  assert.deepEqual(capped.ran, [], 'a live agent at the cap holds the click like it holds the sweep')
})

test('a sweep narrowed to a locked job never falls through to the queued work or another rotation job (#1643/#1774)', async () => {
  // The branch has moved, so the scheduled sweep would work the queue; the rotation is on
  // another job's turn, so the index would fire that one. The click named the locked routine and
  // gets it alone — and the scheduled tick after it still gets the queued work it was owed.
  const other: AutoPmJob = { name: 'update', prompt: 'Update.' }
  const { loop, branch, ran } = harness({ jobs: [other, LOCKED_JOB], cooldownMs: 0 })
  await loop.tick()
  branch.move()
  await loop.tick({ onDemand: true, only: { lock: 'triage-quick' }, projectId: 'p1' })
  assert.deepEqual(ran, ['update', 'triage-quick'], 'neither the moved branch nor the rotation index took the click')
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['update', 'triage-quick', AUTO_PM_WORK_JOB.name], 'the scheduled tick still gets the move it was owed')
})

test('the triage jobs hold a lock named after them, and their prompts no longer abort on a branch (#1659)', () => {
  const locked = AUTO_PM_JOBS.filter(job => job.lock !== undefined)
  assert.deepEqual(locked.map(job => job.name), ['triage-quick', 'triage-consensual'])
  for (const job of locked) {
    assert.equal(job.lock, job.name)
    // The daemon decides; the prompt's "branch already exists → abort" spent an agent to find out.
    assert.ok(!job.prompt.includes('already exists'), `${job.name} must not carry the branch abort`)
  }
})
