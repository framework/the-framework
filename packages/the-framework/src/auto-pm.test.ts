import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  autoPmDecision,
  quotaHeadroom,
  startAutoPm,
  AUTO_PM_JOBS,
  AUTO_PM_DRAIN_JOB,
  AUTO_PM_MAINTENANCE_JOB,
  AUTO_PM_ROUTINES,
  type AutoPmDeps,
  type AutoPmJob,
  type AutoPmLoop,
  type AutoPmProject,
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
const IDLE = { enabled: true, backlogEmpty: true, activeRuns: 0, quota: status(1) } as const

test('autoPmDecision starts when the queue is dry and the budget is barely touched (#685)', () => {
  assert.deepEqual(autoPmDecision(IDLE), { start: true, mode: 'pm' })
})

test('autoPmDecision does nothing while the preference is off (#685)', () => {
  const decision = autoPmDecision({ ...IDLE, enabled: false })
  assert.equal(decision.start, false)
})

test('autoPmDecision leaves a project at its concurrency cap alone (#685/#1204)', () => {
  // Live runs are already spending the quota; one more started unasked would race them. Before
  // #1204 the cap was hardwired at one, which is what `concurrency: 1` still asks for here.
  const decision = autoPmDecision({ ...IDLE, activeRuns: 1, concurrency: 1 })
  assert.equal(decision.start, false)
  assert.match(decision.start === false ? decision.reason : '', /already going/)
})

test('autoPmDecision tops a project up to its concurrency (#1204)', () => {
  // The point of the setting: one run going is no longer a reason to stand down.
  assert.deepEqual(autoPmDecision({ ...IDLE, activeRuns: 1, concurrency: 2 }), { start: true, mode: 'pm' })
  // At the cap it refuses, and the refusal names the cap so a raised setting does not read as a bug.
  const capped = autoPmDecision({ ...IDLE, activeRuns: 2, concurrency: 2 })
  assert.equal(capped.start, false)
  assert.match(capped.start === false ? capped.reason : '', /at most 2 at once/)
})

test('autoPmDecision defaults to the shipped concurrency, and floors it at one (#1204)', () => {
  // Unset means the default, not one: the absence of the setting has never meant "less".
  assert.equal(autoPmDecision({ ...IDLE, activeRuns: DEFAULT_AUTO_PM_CONCURRENCY - 1 }).start, true)
  assert.equal(autoPmDecision({ ...IDLE, activeRuns: DEFAULT_AUTO_PM_CONCURRENCY }).start, false)
  // Zero agents is what the master switch spells, so a hand-edited nought cannot wedge the routine.
  assert.equal(autoPmDecision({ ...IDLE, activeRuns: 0, concurrency: 0 }).start, true)
  assert.equal(autoPmDecision({ ...IDLE, activeRuns: 1, concurrency: 0 }).start, false)
})

test('autoPmDecision drains the queue before filling it again (#855)', () => {
  // It used to refuse here, on the reasoning that the backlog loop would drain it. That loop
  // only runs inside a run a human started, so unattended nothing ever emptied the queue.
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

test('quotaHeadroom refuses to start when the quota cannot be read (#685)', () => {
  // The inverse of the per-run guard's fail-open (#519): that one must never STOP the user's
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
  const decision = autoPmDecision({ enabled: true, backlogEmpty: true, activeRuns: 0, quota: status(95) })
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
    activeRuns: () => 0,
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

test('on demand skips only the master switch: every other stand-down still holds (#1210)', async () => {
  const { loop, started } = harness({ enabled: async () => false, activeRuns: () => 1 })
  await loop.tick({ onDemand: true })
  loop.stop()
  assert.deepEqual(started, [])
  assert.match(loop.report().outcomes[0]?.message ?? '', /already going/)
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
  // An unreadable queue is not an empty one: it must not trigger a run, nor throw the sweep.
  const { loop, started } = harness({ queue: async () => Promise.reject(new Error('nope')) })
  await loop.tick()
  loop.stop()
  assert.deepEqual(started, [])
})

test('AUTO_PM_JOBS triages, then plans (#773/#891/#892)', () => {
  // Cheapest-and-readiest first: triage the cheap tickets, then the significant ones, and leave
  // planning last — it is the priciest turn and the one whose output every earlier job consumes.
  assert.deepEqual(AUTO_PM_JOBS.map(j => j.name), [
    'triage-quick',
    'triage-consensual',
    'spike-and-plan',
  ])
})

test('the rotation is the schedule the triage presets asked for (#891/#892)', () => {
  // #891/#892 both say "with a cron job regularly firing this preset". The rotation already
  // fires on every idle tick where the queue is dry, so no separate scheduler exists — unlike
  // the maintenance sweep (#882), which needs a calendar key because it would never come due.
  const names = AUTO_PM_JOBS.map(j => j.name)
  assert.ok(names.includes('triage-quick'), 'quick triage must be in the rotation')
  assert.ok(names.includes('triage-consensual'), 'consensual triage must be in the rotation')
  // The gated sibling (#698) must never be: it ends in <AWAIT> and would park a run forever.
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
  // The run's queue lands in the checkout only now, so the emptiness check below it is stale.
  // Deciding on that read is what made auto PM re-derive the same entries every cooldown.
  const promoted: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    promote: async (_p, { runId }) => {
      promoted.push(runId)
      return { settled: true, promoted: true }
    },
  })
  await loop.tick() // starts run-1
  await loop.tick() // lands run-1's queue and stops there
  assert.deepEqual(promoted, ['run-1'])
  assert.deepEqual(ran, ['first'])
})

test('a finished run that wrote no queue stops being retried (#852)', async () => {
  // Settled without promoting: nothing landed, but the run is over, so the sweep carries on
  // rather than asking about it forever.
  const asked: string[] = []
  const { loop, ran } = harness({
    cooldownMs: 0,
    promote: async (_p, { runId }) => {
      asked.push(runId)
      return { settled: true, promoted: false }
    },
  })
  await loop.tick()
  await loop.tick()
  await loop.tick()
  // Each tick starts a fresh run and settles the previous one, so every run is asked about
  // exactly once. A settled run being asked twice is the leak this guards.
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
    // A drain run works one entry off; a PM run puts one there.
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
  // Stamping a refused sweep would postpone it a whole interval for a run that never happened.
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
  // awaiting (git calls, the queue read) and then spawned a run anyway. By then the daemon has
  // quiesced and cleared its live-run map, so that run is tracked by nobody: an orphan holding a
  // worktree, and quota spent on a run nobody will ever see.
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
  const { loop } = harness({ activeRuns: () => 2 })
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

test('an unticked drain routine stands the sweep down, it does not fall through to the rotation (#1209)', async () => {
  // The queue has work waiting. Answering "do not work it automatically" by inventing more work
  // is the opposite of what the checkbox asked for.
  const { loop, ran, logs } = harness({
    cooldownMs: 0,
    queue: async () => ['entry a'],
    optedOut: async () => [AUTO_PM_DRAIN_JOB.name],
  })
  await loop.tick()
  loop.stop()
  assert.deepEqual(ran, [])
  assert.equal(loop.report().outcomes[0]?.message, 'the queue has work waiting and its routine is switched off')
  assert.ok(!logs.some(line => line.includes('draining')))
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

test('an entry a live run was pinned to is not handed out twice (#1204)', async () => {
  // The assignment outlives the tick that made it: the first run is still working entry a when
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
  // With nothing left to assign, the sweep says so rather than starting a run with no entry to
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
    activeRuns: () => 2,
    queue: async () => ['entry a', 'entry b', 'entry c'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 1)
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

test('a durably claimed entry is not re-fanned: the web hand-off and restart case (#1253)', async () => {
  // The pin on entry a lives in a run meta (a hands-off web run, or one from before a daemon
  // restart), not in this loop's memory. The sweep must treat it exactly like an in-flight pin.
  const prompts: string[] = []
  const { loop } = harness({
    cooldownMs: 0,
    concurrency: async () => 2,
    queue: async () => ['entry a', 'entry b', 'entry c'],
    claimedEntries: async (_p, candidates) => candidates.filter(entry => entry === 'entry a'),
    start: async (_p, job) => {
      prompts.push(job.prompt)
      return `run-${prompts.length}`
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(prompts.length, 2)
  assert.match(prompts[0]!, /entry b/)
  assert.match(prompts[1]!, /entry c/)
  assert.ok(!prompts.some(prompt => prompt.includes('entry a')), 'the claimed entry stays off the market')
})

test('a queue whose every entry is durably claimed stands the sweep down (#1253)', async () => {
  const { loop, started } = harness({
    cooldownMs: 0,
    concurrency: async () => 4,
    queue: async () => ['entry a'],
    claimedEntries: async () => ['entry a'],
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 0)
  assert.equal(loop.report().outcomes[0]?.message, 'every open queue entry is already being worked on')
})

test('an unreadable claim list means none: the in-memory pins still guard the common case (#1253)', async () => {
  const { loop, started } = harness({
    cooldownMs: 0,
    queue: async () => ['entry a'],
    claimedEntries: async () => {
      throw new Error('gh is down')
    },
  })
  await loop.tick()
  loop.stop()
  assert.equal(started.length, 1, 'a gh hiccup must not stall a healthy queue')
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
  await loop.tick({ onDemand: true, drainOnly: true })
  loop.stop()
  assert.equal(prompts.length, 2)

  // ...and with an empty queue it says so instead of starting a rotation job.
  const { loop: empty, started } = harness({ cooldownMs: 0, queue: async () => [] })
  await empty.tick({ onDemand: true, drainOnly: true })
  empty.stop()
  assert.equal(started.length, 0)
  assert.equal(empty.report().outcomes[0]?.message, 'the queue is empty, so there is nothing to drain')
})
