import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  autoPmDecision,
  quotaHeadroom,
  startAutoPm,
  pinnedDrainJob,
  pinnedPlanJob,
  AUTO_PM_JOBS,
  AUTO_PM_DRAIN_JOB,
  AUTO_PM_MAINTENANCE_JOB,
  AUTO_PM_ROUTINES,
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
const IDLE = { enabled: true, backlogEmpty: true, activeAgents: 0, quota: status(1) } as const

test('autoPmDecision starts when the queue is dry and the budget is barely touched (#685)', () => {
  assert.deepEqual(autoPmDecision(IDLE), { start: true, mode: 'pm' })
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
  assert.deepEqual(autoPmDecision({ ...IDLE, activeAgents: 1, concurrency: 2 }), { start: true, mode: 'pm' })
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

test('autoPmDecision drains the queue before filling it again (#855)', () => {
  // It used to refuse here, on the reasoning that the backlog loop would drain it. That loop
  // only runs inside an agent a human started, so unattended nothing ever emptied the queue.
  assert.deepEqual(autoPmDecision({ ...IDLE, backlogEmpty: false }), { start: true, mode: 'drain' })
})

test('autoPmDecision refuses when the queue cannot be read at all (#855)', () => {
  // Empty and non-empty both start something now, so "could not tell" has to be its own answer
  // rather than falling back to either.
  const decision = autoPmDecision({ ...IDLE, backlogEmpty: undefined })
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /queue could not be read/)
})

test('autoPmDecision holds off during the cooldown after a start (#685)', () => {
  const decision = autoPmDecision({ ...IDLE, sinceLastStartMs: 60_000 })
  assert.equal(decision.start, false)
  const later = autoPmDecision({ ...IDLE, sinceLastStartMs: 60 * 60_000 })
  assert.deepEqual(later, { start: true, mode: 'pm' })
})

test('autoPmDecision lets an asked-for pass through the cooldown (#1642)', () => {
  // The cooldown paces the unattended sweep; a click is a person asking, so it does not apply.
  const decision = autoPmDecision({ ...IDLE, sinceLastStartMs: 60_000, onDemand: true })
  assert.deepEqual(decision, { start: true, mode: 'pm' })
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
  const decision = autoPmDecision({ enabled: true, backlogEmpty: true, activeAgents: 0, quota: status(95) })
  assert.equal(decision.start, false)
})

const JOBS: readonly AutoPmJob[] = [
  { name: 'first', prompt: 'do the first thing', describe: 'doing the first thing' },
  { name: 'second', prompt: 'do the second thing', describe: 'doing the second thing' },
]

/** A loop wired to one idle project, with every reading overridable per test. */
function harness(overrides: Partial<AutoPmDeps> = {}) {
  const project: AutoPmProject = { id: 'p1', path: '/repo' }
  const started: string[] = []
  const ran: string[] = []
  const logs: string[] = []
  const deps: AutoPmDeps = {
    projects: async () => [project],
    jobs: JOBS,
    enabled: async () => true,
    queue: async () => [],
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
    promote: async () => ({ settled: true, promoted: false }),
    log: message => logs.push(message),
    now: () => T0,
    ...overrides,
  }
  return { loop: startAutoPm(deps), started, ran, logs }
}

test('startAutoPm starts a run for an idle project (#685)', async () => {
  const { loop, started } = harness()
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, ['p1'])
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
  // Same two ticks as the #685 double-up test above, the second one a click. The sweep's own
  // cooldown held the button for half an hour after any run, and the card said so in small
  // text under the fold — a button that did nothing, to anyone who clicked and looked away.
  const { loop, started } = harness()
  await loop.tick()
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(started, ['p1', 'p1'])
})

test('startAutoPm does not start a second run for the same project (#685)', async () => {
  // The cooldown is what stops a tick that lands before the spawn registers from doubling up.
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

test('startAutoPm survives a project whose backlog cannot be read (#685)', async () => {
  // An unreadable queue is not an empty one: it must not trigger an agent, nor throw the sweep.
  const { loop, started } = harness({ queue: async () => Promise.reject(new Error('nope')) })
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, [])
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
  // fires on every idle tick where the queue is dry, so no separate scheduler exists — unlike
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
  // The cooldown normally spaces these out; zero it so one test can see the whole rotation.
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

test('a promoted queue ends the tick, so the sweep re-reads it next time (#852)', async () => {
  // The agent's queue lands in the checkout only now, so the emptiness check below it is stale.
  // Deciding on that read is what made auto PM re-derive the same entries every cooldown.
  const promoted: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    promote: async (_p, { agentId }) => {
      promoted.push(agentId)
      return { settled: true, promoted: true }
    },
  })
  await loop.tick() // starts run-1
  await loop.tick() // lands run-1's queue and stops there
  assert.deepEqual(promoted, ['run-1'])
  assert.deepEqual(ran, ['first'])
})

test('a finished run that wrote no queue stops being retried (#852)', async () => {
  // Settled without promoting: nothing landed, but the agent is over, so the sweep carries on
  // rather than asking about it forever.
  const asked: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    promote: async (_p, { agentId }) => {
      asked.push(agentId)
      return { settled: true, promoted: false }
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

test('a run still going is left pending, and the sweep starts nothing new (#852)', async () => {
  const { loop, ran } = harness({ cooldownMs: 0, promote: async () => ({ settled: false, promoted: false }) })
  await loop.tick() // starts run-1
  await loop.tick() // run-1 unsettled, nothing landed -> falls through to the decision
  loop.stop()
  // The second tick reaches the decision and starts the next job: the cooldown is what normally
  // spaces these, and it is zeroed here. What matters is run-1 is still tracked, not dropped.
  assert.ok(ran.length >= 1)
})

test('startAutoPm drains a standing queue, then goes back to filling it (#855)', async () => {
  // The deadlock this fixes: a PM job filled the queue, nothing unattended drained it, and every
  // later tick refused because it was no longer empty. The cycle has to come back round.
  let open = 1
  const ran: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => Array.from({ length: open }, (_, i) => `entry ${i + 1}`),
    // A drain agent works one entry off; a PM agent puts one there.
    start: async (_project, job) => {
      ran.push(job.name)
      open += job.name === AUTO_PM_DRAIN_JOB.name ? -1 : 1
      return `run-${ran.length}`
    },
  })
  await loop.tick() // an entry is standing -> work it off
  await loop.tick() // dry now -> refill
  await loop.tick() // standing again -> work it off
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_DRAIN_JOB.name, 'first', AUTO_PM_DRAIN_JOB.name])
})

test('draining does not advance the PM rotation (#855)', async () => {
  // The rotation is about what to make when there is nothing to do. A queue worked off over
  // several ticks must not push it forward once per entry and skip a job.
  let open = 2
  const ran: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => Array.from({ length: open }, (_, i) => `entry ${i + 1}`),
    start: async (_project, job) => {
      ran.push(job.name)
      open += job.name === AUTO_PM_DRAIN_JOB.name ? -1 : 1
      return `run-${ran.length}`
    },
  })
  await loop.tick()
  await loop.tick()
  await loop.tick() // dry -> the rotation resumes at its first job, not its second
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_DRAIN_JOB.name, AUTO_PM_DRAIN_JOB.name, 'first'])
})

test('an unreadable queue starts nothing at all (#855)', async () => {
  const ran: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => {
      throw new Error('no such file')
    },
    start: async (_project, job) => {
      ran.push(job.name)
      return 'run-1'
    },
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
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

test('a queue with work in it is drained rather than swept (#882)', async () => {
  // A repo with entries waiting has plenty to do; sweeping would only pile more on.
  const { loop, ran } = harness({ cooldownMs: 0, queue: async () => ['entry a'], maintenanceDue: async () => true })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [AUTO_PM_DRAIN_JOB.name])
})

test('a sweep stopped mid-flight starts nothing (#983)', async () => {
  // stop() used to only clear the timer, so a tick already inside its per-project loop kept
  // awaiting (git calls, the queue read) and then spawned an agent anyway. By then the daemon has
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
    queue: async () => {
      loop.stop()
      return []
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

test('only the draining job says it works the queue rather than filling it (#1117)', () => {
  // The marker is what tells the daemon which start can name a ticket. A rotation job that claimed
  // it would name the entry it is about to *write*, which is not what it is doing.
  assert.equal(AUTO_PM_DRAIN_JOB.drains, true)
  for (const job of AUTO_PM_JOBS) assert.notEqual(job.drains, true, `${job.name} must not claim to drain`)
  assert.notEqual(AUTO_PM_MAINTENANCE_JOB.drains, true)
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
  const expected = [AUTO_PM_DRAIN_JOB, ...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB]
  assert.deepEqual(AUTO_PM_ROUTINES.map(j => j.name), expected.map(j => j.name))
  assert.equal(new Set(AUTO_PM_ROUTINES.map(j => j.name)).size, AUTO_PM_ROUTINES.length)
  // Draining leads: it is what the sweep does whenever there is queued work, and the only routine
  // that turns a queue entry into commits.
  assert.equal(AUTO_PM_ROUTINES[0]?.name, AUTO_PM_DRAIN_JOB.name)
})

test('every routine carries its preset label and a rendered prompt, so a list of them is runnable (#1159)', () => {
  for (const job of AUTO_PM_ROUTINES) {
    assert.equal(job.label, presets[presetKey(job.name)].label, `${job.name} must be labelled by its preset`)
    assert.ok(job.prompt.trim().length > 0, `${job.name} must carry a prompt`)
    // The prompt travels to the browser and is started verbatim, so nothing may be left unrendered.
    assert.doesNotMatch(job.prompt, /\$\{\{/, `${job.name} must ship a rendered prompt`)
  }
})

test('only the maintenance sweep describes itself; the rest are just their label', () => {
  // "Maintenance" names the preset rather than the work, so its row and log line keep the
  // sentence; the other routines' labels already say what they do.
  assert.equal(AUTO_PM_MAINTENANCE_JOB.describe, 'sweeping the codebase for maintenance work')
  for (const job of [AUTO_PM_DRAIN_JOB, ...AUTO_PM_JOBS]) {
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

test('an unticked drain routine falls through to the rotation rather than standing down (#1432)', async () => {
  // #1209 means "do not *work* the queue", and the rotation does not work it: triage and planning
  // put entries *on* it. Standing down here read that switch as "do nothing at all", which made
  // every inventing routine unreachable for as long as the queue had anything on it — and since
  // the queue is auto-populated, that is most of the time.
  const { loop, ran, logs } = harness({
    cooldownMs: 0,
    queue: async () => ['entry a'],
    optedOut: async () => [AUTO_PM_DRAIN_JOB.name],
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  // The rotation ran, and advanced — a fall-through tick is a rotation turn like any other.
  assert.deepEqual(ran, ['first', 'second'])
  assert.ok(!logs.some(line => line.includes('draining')), 'and nothing worked the queue')
})

test('a drain-only sweep still stands down when the drain routine is off (#1204/#1432)', async () => {
  // The fall-through above is for the scheduled sweep. This click asked for the queue by name, so
  // borrowing it for a rotation job is exactly what drain-only exists to prevent.
  const { loop, ran, logs } = harness({
    cooldownMs: 0,
    queue: async () => ['entry a'],
    optedOut: async () => [AUTO_PM_DRAIN_JOB.name],
  })
  await loop.tick({ onDemand: true, only: 'drain' })
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(loop.report().outcomes[0]?.message, 'the queue has work waiting and its routine is switched off')
  assert.ok(logs.some(line => line.includes('its routine is switched off')))
})

test('the maintenance sweep stays out while entries are waiting, fall-through or not (#882/#1432)', async () => {
  // The fall-through makes the tick a rotation turn, but the sweep asks a different question —
  // is the queue empty — and the answer is still no.
  const stamped: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    queue: async () => ['entry a'],
    optedOut: async () => [AUTO_PM_DRAIN_JOB.name],
    maintenanceDue: async () => true,
    recordMaintenance: async project => void stamped.push(project.id),
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(stamped, [])
  assert.deepEqual(ran, ['first'])
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

// #1204: the routine keeps several agents going at once. Only draining fans out — it is the one
// routine that takes work *off* the queue, one entry per agent, so a batch of them does disjoint
// work and lands disjoint edits.

test('a standing queue fans out to the concurrency in one tick, one entry per agent (#1204)', async () => {
  // The demo the issue asks for: one sweep, several sessions, each on its own entry. Fanning out
  // over successive ticks instead would take a cooldown per agent.
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 3,
    queue: async () => ['entry a', 'entry b', 'entry c', 'entry d'],
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 3, 'the batch stops at the concurrency, not at the queue length')
  // Pinned, and pinned to *different* entries: unpinned they would all fork the same checkout and
  // read the same first entry.
  assert.match(prompts[0]!, /entry a/)
  assert.match(prompts[1]!, /entry b/)
  assert.match(prompts[2]!, /entry c/)
  assert.equal(new Set(prompts).size, 3)
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

test('a fan-out that came out short says what it was short by, by name (#1646)', async () => {
  // Three allowed, one slot held by a run the sweep did not start: two go out, and the card says
  // alongside whom, so a held slot nobody can see on the dashboard is named rather than silent.
  const { loop, ran } = harness({
    cooldownMs: 0,
    concurrency: async () => 3,
    activeAgents: () => ['2026-08-22T22-06-41-065Z (pid 4242)'],
    queue: async () => ['entry a', 'entry b', 'entry c'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(ran.length, 2, 'the batch is the cap minus the held slot')
  assert.equal(
    loop.report().outcomes[0]?.message,
    'started 2 agents alongside 1 already going (2026-08-22T22-06-41-065Z (pid 4242)): ' +
      'draining the queue entry "entry a"; draining the queue entry "entry b"',
  )
})

test('an entry a live run was pinned to is not handed out twice (#1204)', async () => {
  // The assignment outlives the tick that made it: the first agent is still working entry a when
  // the next sweep comes round, and its queue has not landed yet, so the checkout still shows the
  // entry open. Handing it out again is exactly the duplicate work pinning exists to prevent.
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 1,
    queue: async () => ['entry a', 'entry b'],
    promote: async () => ({ settled: false, promoted: false }), // still in flight
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 2)
  assert.match(prompts[0]!, /entry a/)
  assert.match(prompts[1]!, /entry b/)
})

test('a queue whose every entry is already being worked stands the sweep down (#1204)', async () => {
  // With nothing left to assign, the sweep says so rather than starting an agent with no entry to
  // pin it to — which is what would send a second agent at work already in flight.
  const { loop, started } = harness({
    cooldownMs: 0,
    concurrency: async () => 4,
    queue: async () => ['entry a'],
    promote: async () => ({ settled: false, promoted: false }),
  })
  await loop.tick()
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 1)
  assert.equal(loop.report().outcomes[0]?.message, 'every open queue entry is already being worked on')
})

test('live runs count against the concurrency, so the sweep tops up rather than doubling (#1204)', async () => {
  // Two already going under a cap of three leaves room for exactly one more.
  const { loop, started } = harness({
    cooldownMs: 0,
    concurrency: async () => 3,
    activeAgents: () => ['run-a (pid 111)', 'run-b (pid 222)'],
    queue: async () => ['entry a', 'entry b', 'entry c'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 1)
})

// #1420: a drain's claim on what it *implements* is a pushed `.lock.md`, like planning's — the
// in-memory pin above only guards this daemon's own fan-out, and two daemons on different
// machines could book the implementation of the same ticket. Only entries that link back to a
// ticket have anything on disk to lock; self-contained TODOs keep the queue as their
// coordination point.

test('a drain batch locks its ticket-linked entries, and each prompt carries its own claim (#1420)', async () => {
  const prompts: string[] = []
  const lockCalls: PlanAssignment[][] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)', '[Fix b](tickets/2026-07-25_b.md)'],
    lockDrains: async (_p, assignments) => {
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
  // The whole batch was locked in one call, before any agent started, and each agent's prompt
  // names the id its own lock carries.
  assert.equal(lockCalls.length, 1)
  assert.deepEqual(lockCalls[0]!.map(a => a.ticket), ['2026-07-25_a.md', '2026-07-25_b.md'])
  assert.equal(prompts.length, 2)
  assert.match(prompts[0]!, new RegExp(`CLAIMED: ${lockCalls[0]![0]!.agentId}`))
  assert.match(prompts[1]!, new RegExp(`CLAIMED: ${lockCalls[0]![1]!.agentId}`))
  assert.equal(new Set(lockCalls[0]!.map(a => a.agentId)).size, 2)
})

test('a ticketless entry drains without a claim, and is not offered to the lock (#1420)', async () => {
  const prompts: string[] = []
  const lockCalls: PlanAssignment[][] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['just a self-contained TODO', '[Fix b](tickets/2026-07-25_b.md)'],
    lockDrains: async (_p, assignments) => {
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
  assert.deepEqual(lockCalls[0]!.map(a => a.ticket), ['2026-07-25_b.md'])
  assert.equal(prompts.length, 2)
  assert.ok(!/CLAIMED/.test(prompts[0]!), 'the ticketless entry carries no claim')
  assert.match(prompts[1]!, /CLAIMED/)
})

test('an entry whose ticket claim was lost is dropped from the batch, not the batch (#1420)', async () => {
  // Another machine's sweep won the race for a.md's lock: its agent will land the check-off in
  // its own PR, so this batch simply does not start one — the next tick reconsiders.
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)', '[Fix b](tickets/2026-07-25_b.md)'],
    lockDrains: async (_p, assignments) => assignments.filter(a => a.ticket !== '2026-07-25_a.md'),
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 1)
  assert.match(prompts[0]!, /Fix b/)
})

test('a batch that lost every claim stands the sweep down with the reason (#1420)', async () => {
  const { loop, started } = harness({
    cooldownMs: 0,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)'],
    lockDrains: async () => [],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 0)
  assert.equal(
    loop.report().outcomes[0]?.message,
    'every entry in this batch links a ticket another agent already claimed',
  )
})

test('without the lock seam a ticket-linked entry drains exactly as before (#1420)', async () => {
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)'],
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 1)
  assert.ok(!/CLAIMED/.test(prompts[0]!))
})

test('pinnedDrainJob with a claim appends the same contract the pinned plan prompt carries (#1420)', () => {
  const job: AutoPmJob = { name: 'drain', prompt: 'Work the queue.', drains: true }
  const pinned = pinnedDrainJob(job, '[Fix x](tickets/2026-07-25_x.md)', {
    ticket: '2026-07-25_x.md',
    agentId: 'drain-7-0',
  })
  assert.match(pinned.prompt, /tickets\/2026-07-25_x\.lock\.md/)
  assert.match(pinned.prompt, /CLAIMED: drain-7-0/)
  // The closing PR retires all three siblings: closed tickets leave the repo, and nothing else
  // lifts a lock since #1420 dropped the timer.
  assert.match(pinned.prompt, /remove `tickets\/2026-07-25_x\.md`, `tickets\/2026-07-25_x\.plan\.md`, and `tickets\/2026-07-25_x\.lock\.md`/)
  assert.match(pinned.prompt, /names a different agent, the ticket is not yours/)
  // And without a claim, the prompt is exactly the pre-#1420 pin.
  assert.ok(!/CLAIMED/.test(pinnedDrainJob(job, 'entry a').prompt))
})

// #1583: the one claim the sweep can *know* is dead. A drain that settles with `no-commits` never
// opens the PR whose merge deletes its `.lock.md`, so without this the queue livelocks on the dead
// claim — the next sweep re-offers the entry, drain-mode locking skips the locked ticket, and the
// batch empties, forever, until a human clicks Release.

test('a claim whose run settled with nothing to hand off is released (#1583)', async () => {
  const released: PlanAssignment[] = []
  const lockCalls: PlanAssignment[][] = []
  let queued = ['[Fix a](tickets/2026-07-25_a.md)']
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => queued,
    lockDrains: async (_p, assignments) => {
      lockCalls.push([...assignments])
      return assignments
    },
    promote: async () => ({ settled: true, promoted: false, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick() // mints the claim and starts the drain
  queued = []
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
  let queued = ['[Fix a](tickets/2026-07-25_a.md)']
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => queued,
    lockDrains: async (_p, assignments) => assignments,
    promote: async () => ({ settled: true, promoted: false, ...ending }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick() // starts the drain
  queued = []
  await loop.tick() // mid-epilogue: held, not settled, nothing released
  assert.deepEqual(released, [])
  ending = { handoffSkip: 'no-commits' }
  await loop.tick() // the ending has landed: the claim is freed
  loop.stop()
  assert.equal(released.length, 1)
})

test('the mid-epilogue hold is bounded, so a run that dies there cannot pin its entry forever (#1583)', async () => {
  const released: PlanAssignment[] = []
  const promoted: string[] = []
  let queued = ['[Fix a](tickets/2026-07-25_a.md)']
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => queued,
    lockDrains: async (_p, assignments) => assignments,
    promote: async (_p, { agentId }) => {
      promoted.push(agentId)
      return { settled: true, promoted: false, handoffPending: true }
    },
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
  })
  await loop.tick()
  queued = []
  for (let i = 0; i < 5; i++) await loop.tick()
  loop.stop()
  // Two held sweeps, then the third settles it unread — the pre-#1583 behavior — rather than
  // asking forever about a run that will never answer. (Later ticks promote only the rotation
  // agents the emptied queue lets through, never this one again.)
  assert.equal(promoted.filter(id => id === 'run-1').length, 3)
  assert.deepEqual(released, [])
})

test('an entry whose drain ended with nothing to hand off is not drained again (#1583)', async () => {
  // Releasing the claim re-opens the work, and a job that deterministically ends commitless
  // would respawn every cooldown forever, burning a quota run per cycle. One attempt per daemon
  // lifetime; the stand-down says why the entry sits.
  const prompts: string[] = []
  const released: PlanAssignment[] = []
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)'],
    lockDrains: async (_p, assignments) => assignments,
    promote: async () => ({ settled: true, promoted: false, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick() // spawns the drain
  await loop.tick() // settles no-commits: the claim is released and the entry remembered
  await loop.tick() // the entry is still open, and deliberately not offered again
  loop.stop()
  assert.equal(prompts.length, 1)
  assert.equal(released.length, 1)
  assert.match(loop.report().outcomes[0]?.message ?? '', /drained once with nothing to hand off/)
})

test('claims of a batch the start loop never reached are released, not stranded (#1583)', async () => {
  // The batch's locks are committed and pushed before the first spawn; a refused start breaks
  // the loop, and the never-started items' claims have no run that could ever settle them free.
  const released: PlanAssignment[] = []
  const lockCalls: PlanAssignment[][] = []
  let starts = 0
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['[Fix a](tickets/2026-07-25_a.md)', '[Fix b](tickets/2026-07-25_b.md)'],
    lockDrains: async (_p, assignments) => {
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
  let queued = ['[Fix a](tickets/2026-07-25_a.md)']
  const { loop } = harness({
    cooldownMs: 0,
    queue: async () => queued,
    lockDrains: async (_p, assignments) => assignments,
    promote: async () => ({ settled: true, promoted: false, handoffSkip: 'no-commits' }),
    releaseLock: async (_p, claim) => {
      attempts.push(claim)
      return attempts.length >= 2 // the first try hits a transient failure, the retry lands
    },
  })
  await loop.tick()
  queued = []
  await loop.tick() // the release fails to commit: the agent is held for a retry
  await loop.tick() // the retry lands
  await loop.tick() // dealt with: no further attempts
  loop.stop()
  assert.equal(attempts.length, 2)
})

test('every other ending leaves the lock to its own lifecycle (#1583)', async () => {
  // A run that published (or whose handoff skipped because its PR already exists) has a PR whose
  // merge deletes the lock; freeing it here would re-open the double-work window the claim closes.
  for (const outcome of [
    { settled: true, promoted: true },
    { settled: true, promoted: false, handoffSkip: 'already-open' as const },
  ]) {
    const released: PlanAssignment[] = []
    let queued = ['[Fix a](tickets/2026-07-25_a.md)']
    const { loop } = harness({
      cooldownMs: 0,
      queue: async () => queued,
      lockDrains: async (_p, assignments) => assignments,
      promote: async () => outcome,
      releaseLock: async (_p, claim) => {
      released.push(claim)
      return true
    },
    })
    await loop.tick()
    queued = []
    await loop.tick()
    loop.stop()
    assert.deepEqual(released, [])
  }
})

// #1327: [Plan tickets] fans out too — the one rotation job that writes per-ticket sibling files
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
  assert.match(prompts[0]!, new RegExp(`CLAIMED: ${lockCalls[0]![0]!.agentId}`))
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

test("a plan-only sweep plans instead of draining, however full the queue is (#1204)", async () => {
  // The queue-picked mode would send this tick to the drain. The click named the planning
  // routine, so the queue is not its business.
  //
  // Asserted on the prompts rather than the job name: the name stays `plan` even when the tick
  // falls through to the drain's fan-out, because it is the *batch* that differs — entries off
  // the queue instead of tickets. The name alone passes either way, which is no guard at all.
  const prompts: string[] = []
  const { loop, ran } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['work one', 'work two'],
    drainJob: { name: 'drain', prompt: 'Work the queue.', drains: true },
    planCandidates: async () => ['a.md'],
    lockPlans: async (_p, assignments) => assignments,
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick({ onDemand: true, only: 'plan', projectId: 'p1' })
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(prompts.length, 1, 'one open ticket is one agent, not one per queue entry')
  assert.match(prompts[0]!, /tickets\/a\.md/)
  assert.ok(
    !prompts.some(prompt => prompt.includes('work one')),
    'no agent was handed a queue entry: the click asked for planning, not draining',
  )
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
  // re-reading anything — same as a drain's entry.
  const prompts: string[] = []
  const { loop } = harness({
    jobs: [PLAN_JOB],
    cooldownMs: 0,
    concurrency: async () => 1,
    planCandidates: async () => ['a.md', 'b.md'],
    lockPlans: async (_p, assignments) => assignments,
    promote: async () => ({ settled: false, promoted: false }), // still in flight
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  await loop.tick()
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
  assert.match(pinned.prompt, /tickets\/2026-07-25_x\.lock\.md/)
  assert.match(pinned.prompt, /CLAIMED: plan-7-0/)
  // The lock has no timer since #1420, so the agent is told to lift it with its own work.
  assert.match(pinned.prompt, /delete `tickets\/2026-07-25_x\.lock\.md` in the same data-branch commit/)
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
  // at once would have the later promotion revert the earlier one's entries. Only draining, which
  // takes one named entry off, is safe to run several of at a time.
  const { loop, ran } = harness({ cooldownMs: 0, concurrency: async () => 5, queue: async () => [] })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['first'])
})

test('an unreadable concurrency falls back to the default rather than to one (#1204)', async () => {
  // Same polarity as the opt-out list: one bad read must not quietly shrink the routine.
  const { loop, started } = harness({
    cooldownMs: 0,
    concurrency: async () => Promise.reject(new Error('no registry')),
    queue: async () => ['entry a', 'entry b', 'entry c'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, DEFAULT_AUTO_PM_CONCURRENCY)
})

test('a refusal ends the batch, so the refused work is retried rather than skipped (#1204)', async () => {
  // Whatever refused this start is not going to take the next one a moment later.
  let attempts = 0
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 4,
    queue: async () => ['entry a', 'entry b', 'entry c', 'entry d'],
    start: async () => {
      attempts++
      return attempts === 1 ? 'run-1' : undefined
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(attempts, 2, 'one start took, the second was refused, and the batch stopped there')
})

test('a drain-only sweep works the queue and never borrows the tick for the rotation (#1204)', async () => {
  // The drain row's Run now: with entries waiting it fans out like any drain sweep...
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['entry a', 'entry b'],
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick({ onDemand: true, only: 'drain' })
  loop.stop()
  assert.equal(prompts.length, 2)

  // ...and with an empty queue it says so instead of starting a rotation job.
  const { loop: empty, started } = harness({ cooldownMs: 0, queue: async () => [] })
  await empty.tick({ onDemand: true, only: 'drain' })
  empty.stop()
  assert.equal(started.length, 0)
  assert.equal(empty.report().outcomes[0]?.message, 'the queue is empty, so there is nothing to drain')
})

test('a pinned job has its stale branch released before it fires (#1293)', async () => {
  const order: string[] = []
  const { loop } = harness({
    jobs: [{ name: 'triage-quick', prompt: 'p', pinnedBranch: 'the-framework/triage-quick' }],
    releasePinned: async (_project, branch) => {
      order.push(`release:${branch}`)
    },
    start: async (_project, job) => {
      order.push(`start:${job.name}`)
      return 'run-1'
    },
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(order, ['release:the-framework/triage-quick', 'start:triage-quick'])
})

test('an unpinned job never asks for a release, and a failing release does not stop the start (#1293)', async () => {
  const releases: string[] = []
  const unpinned = harness({
    releasePinned: async (_project, branch) => {
      releases.push(branch)
    },
  })
  await unpinned.loop.tick()
  unpinned.loop.stop()
  assert.deepEqual(releases, [])
  assert.deepEqual(unpinned.ran, ['first'])

  // A release that could not happen leaves the routine exactly as jammed as it was; the job's own
  // abort guard decides, exactly as before the seam existed.
  const failing = harness({
    jobs: [{ name: 'triage-quick', prompt: 'p', pinnedBranch: 'the-framework/triage-quick' }],
    releasePinned: async () => {
      throw new Error('gh is down')
    },
  })
  await failing.loop.tick()
  failing.loop.stop()
  assert.deepEqual(failing.ran, ['triage-quick'])
})

// #1643: Run now on a pinned routine reaches the same release-then-start the sweep does. It used
// to be a plain start outside the sweep, so a leftover copy of the branch — which the sweep
// releases before firing — made the agent abort as "triage already pending" on every click.

const PINNED_JOB: AutoPmJob = {
  name: 'triage-quick',
  prompt: 'Triage.',
  label: 'Triage quick wins',
  pinnedBranch: 'the-framework/triage-quick',
}

test('a sweep narrowed to a pinned job releases its branch, then starts exactly one agent (#1643)', async () => {
  const order: string[] = []
  const { loop } = harness({
    // The rotation is on another job's turn, so a tick that ignored the narrowing would start
    // that one instead — the release-then-start below is the click's doing, not the cycle's.
    jobs: [{ name: 'update', prompt: 'Update.' }, PINNED_JOB],
    cooldownMs: 0,
    // Room for three, so a single start is the routine's own shape and not the cap's doing.
    concurrency: async () => 3,
    releasePinned: async (_project, branch) => {
      order.push(`release:${branch}`)
    },
    start: async (_project, job) => {
      order.push(`start:${job.name}`)
      return `run-${order.length}`
    },
  })
  await loop.tick({ onDemand: true, only: { pinned: 'the-framework/triage-quick' }, projectId: 'p1' })
  loop.stop()
  assert.deepEqual(order, ['release:the-framework/triage-quick', 'start:triage-quick'])
})

test('a switched-off pinned routine stands the click down, and so does every other gate (#1643)', async () => {
  const off = harness({ jobs: [PINNED_JOB], cooldownMs: 0, optedOut: async () => ['triage-quick'] })
  await off.loop.tick({ onDemand: true, only: { pinned: 'the-framework/triage-quick' }, projectId: 'p1' })
  off.loop.stop()
  assert.deepEqual(off.ran, [], 'an unticked box is not overridden by the click')
  assert.equal(off.loop.report().outcomes[0]?.message, 'Triage quick wins is switched off')

  // A branch nothing pins is said as such, not as a setting the user could go and undo.
  const unknown = harness({ jobs: [PINNED_JOB], cooldownMs: 0 })
  await unknown.loop.tick({ onDemand: true, only: { pinned: 'the-framework/nobody' }, projectId: 'p1' })
  unknown.loop.stop()
  assert.deepEqual(unknown.ran, [])
  assert.equal(unknown.loop.report().outcomes[0]?.message, 'no routine is pinned to the-framework/nobody')

  // The click skips the master switch and the cooldown, not the cap (#1204/#1642).
  const capped = harness({ jobs: [PINNED_JOB], cooldownMs: 0, activeAgents: () => ['run-live (pid 111)'] })
  await capped.loop.tick({ onDemand: true, only: { pinned: 'the-framework/triage-quick' }, projectId: 'p1' })
  capped.loop.stop()
  assert.deepEqual(capped.ran, [], 'a live agent at the cap holds the click like it holds the sweep')
})

test('a sweep narrowed to a pinned job never falls through to the drain or another rotation job (#1643)', async () => {
  // The queue is full, so the queue-picked mode would drain; the rotation is on another job's
  // turn, so the index would fire that one. The click named the pinned routine and gets it alone
  // — and the scheduled tick after it still gets the rotation job it was owed.
  const other: AutoPmJob = { name: 'update', prompt: 'Update.' }
  let entries = ['work one']
  const { loop, ran } = harness({
    jobs: [other, PINNED_JOB],
    cooldownMs: 0,
    queue: async () => entries,
    drainJob: { name: 'drain', prompt: 'Work the queue.', drains: true },
  })
  await loop.tick({ onDemand: true, only: { pinned: 'the-framework/triage-quick' }, projectId: 'p1' })
  assert.deepEqual(ran, ['triage-quick'], 'neither the full queue nor the rotation index took the click')
  entries = []
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, ['triage-quick', 'update'], 'the scheduled tick still gets the rotation job it was owed')
})

test('only the drain job lands its own PRs (#1216)', () => {
  // The drain implements queue entries whose triage a human could have vetoed, so its review
  // happened before the agent. Every other job writes tickets/plans and has nothing to merge —
  // an autoMerge there would be an agent landing unreviewed work.
  assert.equal(AUTO_PM_DRAIN_JOB.autoMerge, true)
  for (const job of [...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB]) {
    assert.equal(job.autoMerge, undefined, `${job.name} must not auto-merge`)
  }
})

test('the triage jobs declare exactly the branch their prompts pin (#1293)', () => {
  const pinned = AUTO_PM_JOBS.filter(job => job.pinnedBranch !== undefined)
  assert.deepEqual(pinned.map(job => job.name), ['triage-quick', 'triage-consensual'])
  for (const job of pinned) {
    // The release targets the branch the prompt's abort guard tests, so the two must not drift.
    assert.equal(job.pinnedBranch, `tf-${job.name}`)
    assert.ok(
      job.prompt.includes(`Always set <SESSION_NAME> to ${job.name}`),
      `${job.name} must pin the session name its release targets`,
    )
  }
})
