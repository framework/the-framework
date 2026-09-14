import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { startBackgroundServices, syncProjectData } from './daemon-services.js'
import { projectErrorStore } from './project-errors.js'
import { withFileBranch, DATA_BRANCH } from '@gemstack/agent-data'
import { pollerQuotaSource, type QuotaSource } from './dashboard/quota.js'
import { QuotaPoller } from './quota-poller.js'
import { AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB, AUTO_PM_WORK_JOB } from './auto-pm.js'
import { daemonFunnel } from './daemon-writes.js'
import type { DriverQuotaWindow } from 'agent-driver'
import type { StartAgentOptions, StartAgentResult } from './dashboard/types.js'

/**
 * The daemon half of #1774, end to end with the daemon's own spawn stubbed.
 *
 * `auto-pm.test.ts` covers the policy with every reading injected. What was unverified is the
 * wiring either side of it: that the two git reads the sweep is handed see a real `agent-data`
 * branch move, that a commit written through the daemon's own funnel does not count as one, and
 * that what the sweep starts is one agent told `/work-queue` and nothing else. Real git and a real
 * registry; only the child process is stubbed, because the assertion is about what is asked for.
 */

const git = promisify(execFile)

/**
 * A quota source over a real reading, built the way the daemon builds its own (#1619): the poller
 * and `pollerQuotaSource` are the production ones, and only the driver call is stubbed. A hand-made
 * fake would answer whatever the test wanted here, which is exactly how a gate that never passed a
 * model went a year without anyone noticing.
 */
async function accountQuota(windows: DriverQuotaWindow[]): Promise<QuotaSource> {
  const poller = new QuotaPoller({ read: async () => ({ available: true, windows }) })
  await poller.poll()
  return pollerQuotaSource(poller)
}

/** A week that resets four days out, so ~43% of it has elapsed and the boundary sits there. */
function weekResetText(): string {
  const resets = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][resets.getUTCMonth()]
  return `${month} ${resets.getUTCDate()} at 7am (UTC)`
}

/** Every routine but the queued work, so a test about the trigger sees only that one start. */
const ROTATION_OFF = [...AUTO_PM_JOBS, AUTO_PM_MAINTENANCE_JOB].map(job => job.name)

/** A registry + checkout wired to `startBackgroundServices`, with every start recorded. */
async function services(preferences: Record<string, unknown>, quota?: QuotaSource) {
  const config = await mkdtemp(join(tmpdir(), 'framework-daemon-half-cfg-'))
  const project = await mkdtemp(join(tmpdir(), 'framework-daemon-half-proj-'))
  // A real git checkout with the data branch already born (#1582): the sweep's first look
  // remembers its head, and the tests move it from there.
  await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
  await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
  await git('git', ['config', 'user.name', 'Test'], { cwd: project })
  await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
  const seeded = await withFileBranch(project, DATA_BRANCH, 'seed', async dir => {
    await mkdir(join(dir, 'tickets'), { recursive: true })
    await writeFile(join(dir, 'TODO_AGENTS.md'), '')
  })
  assert.ok(seeded.ok, 'the data branch must exist before the daemon looks')
  await writeFile(
    join(config, 'the-framework.json'),
    JSON.stringify({
      projects: [{ id: 'proj-1', path: project, addedAt: '2026-07-27T00:00:00.000Z' }],
      preferences,
    }),
  )
  const starts: { prompt: string; options: StartAgentOptions; projectId: string }[] = []
  const started = startBackgroundServices({
    cwd: project,
    env: { XDG_CONFIG_HOME: config },
    dashboardUrl: 'http://localhost:4000',
    // A reading with room to spare, unless the test is about the gate itself: 1% used against a
    // week that is ~43% elapsed is nowhere near the line.
    quota: quota ?? (await accountQuota([{ label: 'Current week (all models)', kind: 'week', percentUsed: 1, resetsAtText: weekResetText() }])),
    startAgent: async (prompt, options, projectId): Promise<StartAgentResult> => {
      starts.push({ prompt, options, projectId })
      return { ok: true, agentId: `run-${starts.length}` }
    },
    // What the daemon's own counter reports: the agents this sweep has asked for are live, so the
    // cap is measured against them rather than against a constant zero.
    activeAgentSlots: () => starts.map((_, i) => ({ agentId: `run-${i + 1}`, pid: 4000 + i, state: 'live' as const })),
    busyAgentIds: () => new Set<string>(),
    projectErrors: projectErrorStore(),
    log: () => {},
  })
  /** Someone queued an entry: a plain write through the skills' own funnel. */
  const queue = async (entry: string) => {
    const wrote = await withFileBranch(project, DATA_BRANCH, `queue add: ${entry}`, async dir => {
      await writeFile(join(dir, 'TODO_AGENTS.md'), `- ${entry}\n`)
    })
    assert.ok(wrote.ok, 'the fixture entry must land on the data branch')
  }
  const stop = async () => {
    // Awaited: the sweep in flight is what the cleanup below would otherwise delete out from under.
    await started.quiesce()
    await rm(config, { recursive: true, force: true })
    await rm(project, { recursive: true, force: true })
  }
  return { starts, stop, services: started, projectDir: project, queue }
}

/** Poll until `check` holds or the deadline passes; the sweep is fired and not awaited. */
async function settle(check: () => boolean, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
}

test('a commit on the data branch that no daemon wrote starts one agent on the queued work (#1774)', async () => {
  const { starts, stop, services: running, queue } = await services({ autoPm: true, autoPmConcurrency: 4, autoPmOptOut: ROTATION_OFF })
  try {
    // The start-up look remembers the head and starts nothing: the daemon knows nothing about
    // what moved while it was down.
    await settle(() => running.autoPmReport().outcomes.length > 0)
    assert.equal(starts.length, 0, 'the first look starts nothing on the queued work')
    await queue('[Entry one](tickets/2026-07-01_one.md)')
    await running.wakeAutoPm()
    assert.equal(starts.length, 1, 'one agent per move, however high the concurrency: the next needs the branch to move again')
    const [start] = starts
    // The agent is told the routine skill and nothing else: no entry, no ticket, no skill name.
    assert.equal(start!.prompt, AUTO_PM_WORK_JOB.prompt)
    assert.equal(start!.prompt, '/work-queue')
    // Nobody is at the keyboard, so a gate must auto-answer rather than park (#846/#1279).
    assert.equal(start!.options.unattended, true)
    // The queued work lands its own PRs (#1216): the job's flag rides the start as the ladder's
    // top rung, so it reaches the agent already meaning "push, open, merge".
    assert.equal(start!.options.handoff, 'merge')
    assert.equal(start!.options.planAgent, undefined)
    assert.equal(start!.options.agentId, undefined, 'the daemon minted no claim, so the run picks its own id')
    assert.equal(start!.projectId, 'proj-1')
    // And the dashboard is told what went out (#1161).
    const outcome = running.autoPmReport().outcomes[0]
    assert.equal(outcome?.started, true)
    assert.equal(outcome?.message, AUTO_PM_WORK_JOB.label)
    // The move is spent: the next look, with nothing new on the branch, starts nothing.
    await running.wakeAutoPm()
    assert.equal(starts.length, 1)
  } finally {
    await stop()
  }
})

test("a commit the daemon wrote itself is not a move: its run records must not start the next run (#1774)", async () => {
  const { starts, stop, services: running, projectDir } = await services({ autoPm: true, autoPmOptOut: ROTATION_OFF })
  try {
    await settle(() => running.autoPmReport().outcomes.length > 0)
    // The daemon's funnel, as the teardown's record write uses it: signed with the trailer.
    const recorded = await daemonFunnel()(projectDir, 'logs: record run 2026-09-13T10-00-00-000Z', async dir => {
      await mkdir(join(dir, 'agents', 'test'), { recursive: true })
      await writeFile(join(dir, 'agents', 'test', '2026-09-13T10-00-00-000Z.json'), '{}\n')
    })
    assert.ok(recorded.ok)
    await running.wakeAutoPm()
    assert.equal(starts.length, 0)
    // The rotation's start-up turn is still owed and has nothing to fire, which is what the
    // report says; the record moved nothing.
    assert.equal(running.autoPmReport().outcomes[0]?.message, 'every routine that makes new work is switched off')
  } finally {
    await stop()
  }
})

test("the queued-work row's Run now starts one agent with auto-run off, and no move (#1204/#1210/#1774)", async () => {
  const { starts, stop, services: running } = await services({ autoPm: false, autoPmConcurrency: 3 })
  try {
    // The start-up sweep reads the switch and stands down; the click is what asks.
    await settle(() => starts.length > 0, 300)
    assert.equal(starts.length, 0, 'auto-run off means the schedule starts nothing by itself')
    // Exactly what the card's Run now sends for the queued work, through the same `wakeAutoPm`
    // seam the RPC calls.
    await running.wakeAutoPm({ onDemand: true, only: 'work' })
    assert.equal(starts.length, 1, 'the click is one agent on the queue, whatever the branch did')
    assert.equal(starts[0]!.prompt, AUTO_PM_WORK_JOB.prompt)
  } finally {
    await stop()
  }
})

/**
 * The data-sync error state (#1599/#1500): one project's sync turn sets the project's `data-sync`
 * error when the branch cannot converge with origin, and clears it the first time it does. Real
 * git again, because the two outcomes are git's own: no remote at all, then a bare remote added.
 */
test('a project whose data branch cannot reach a remote carries a data-sync error until a sync converges (#1599)', async () => {
  const project = await mkdtemp(join(tmpdir(), 'framework-sync-proj-'))
  const remote = await mkdtemp(join(tmpdir(), 'framework-sync-remote-'))
  try {
    await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
    await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
    await git('git', ['config', 'user.name', 'Test'], { cwd: project })
    await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
    const errors = projectErrorStore()
    const logs: string[] = []

    // No remote: the branch is born locally, but nothing else can ever read it — an error, not a mode.
    await syncProjectData(project, errors, m => logs.push(m))
    const [noRemote] = errors.list(project)
    assert.equal(noRemote?.code, 'data-sync')
    assert.match(noRemote?.message ?? '', /no remote/)
    assert.ok(logs.some(m => m.includes('data sync') && m.includes('no remote')), 'still said on the daemon log too')

    // The user fixes it: the next turn converges and the error is gone, not merely re-worded.
    await git('git', ['init', '-q', '--bare'], { cwd: remote })
    await git('git', ['remote', 'add', 'origin', remote], { cwd: project })
    await syncProjectData(project, errors, () => {})
    assert.deepEqual(errors.list(project), [])
  } finally {
    await rm(project, { recursive: true, force: true })
    await rm(remote, { recursive: true, force: true })
  }
})

test("unattended work stands down when the model it would run on has spent its own week (#1619)", async () => {
  // The account has most of its week left; the model the runs would use has none of its own.
  // Before this was wired, the sweep read the account's 30%, started its batch, and every agent in
  // it died at its first API call with "limit reached".
  const quota = await accountQuota([
    { label: 'Current week (all models)', kind: 'week', percentUsed: 30, resetsAtText: weekResetText() },
    { label: 'Current week (Fable)', kind: 'week-model', percentUsed: 100, resetsAtText: weekResetText() },
  ])
  const { starts, stop, services: running, queue } = await services({ autoPm: true, model: 'claude-fable-5', autoPmOptOut: ROTATION_OFF }, quota)
  try {
    await settle(() => running.autoPmReport().outcomes.length > 0)
    await queue('[Entry one](tickets/2026-07-01_one.md)')
    await running.wakeAutoPm()
    assert.equal(starts.length, 0, 'a spent model week starts nothing, however much of the account week is left')
    // And it says which window stopped it: "the quota" alone would send someone to a panel that
    // is showing 30% and looking fine.
    const outcome = running.autoPmReport().outcomes[0]
    assert.equal(outcome?.started, false)
    assert.match(outcome?.message ?? '', /Current week \(Fable\) is 100% used/)
  } finally {
    await stop()
  }
})

test('the same spent model week does not stop work on a model that has its own allowance left (#1619)', async () => {
  // The gate is the model's week, not any model's week: with the preference on Opus, Fable being
  // spent is none of this run's business — and the account's own week is still under its line.
  const quota = await accountQuota([
    { label: 'Current week (all models)', kind: 'week', percentUsed: 30, resetsAtText: weekResetText() },
    { label: 'Current week (Fable)', kind: 'week-model', percentUsed: 100, resetsAtText: weekResetText() },
  ])
  const { starts, stop, services: running, queue } = await services({ autoPm: true, model: 'claude-opus-5', autoPmOptOut: ROTATION_OFF }, quota)
  try {
    await settle(() => running.autoPmReport().outcomes.length > 0)
    await queue('[Entry one](tickets/2026-07-01_one.md)')
    await running.wakeAutoPm()
    assert.equal(starts.length, 1, 'the run goes out as usual')
    assert.equal(starts[0]!.options.model, 'claude-opus-5', 'and on the model the gate was measured for')
  } finally {
    await stop()
  }
})
