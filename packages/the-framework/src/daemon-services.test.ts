import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { startBackgroundServices, syncProjectData } from './daemon-services.js'
import { projectErrorStore } from './project-errors.js'
import { dataWorktreePath, withDataBranch } from './data-branch.js'
import { pollerQuotaSource, type QuotaSource } from './dashboard/quota.js'
import { QuotaPoller } from './quota-poller.js'
import type { DriverQuotaWindow } from './driver/index.js'
import type { StartAgentOptions, StartAgentResult } from './dashboard/types.js'

/**
 * The concurrent-agents setting, end to end (#1204).
 *
 * `auto-pm.test.ts` covers the policy with every reading injected, which is the half that was
 * already known good. What was unverified is the wiring either side of it: that the number the
 * dashboard writes into the registry is the number `startBackgroundServices` hands the sweep, and
 * that a real checkout with a real `TODO_AGENTS.md` fans out to that many starts, one pinned entry
 * each. Both halves are real here — the registry is read off disk by `readPreferences`, the queue
 * off disk by `findTodoBacklog` — and only the daemon's own spawn is stubbed, because the assertion
 * is about how many agents are asked for and with what, not about the child processes.
 */

/** Six open entries, distinguishable, in the format the sweep's reader actually parses. */
const QUEUE_ENTRIES = [
  '[Entry one](tickets/2026-07-01_one.md) — the first thing',
  '[Entry two](tickets/2026-07-01_two.md) — the second thing',
  '[Entry three](tickets/2026-07-01_three.md) — the third thing',
  '[Entry four](tickets/2026-07-01_four.md) — the fourth thing',
  '[Entry five](tickets/2026-07-01_five.md) — the fifth thing',
  '[Entry six](tickets/2026-07-01_six.md) — the sixth thing',
]

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

/** A registry + checkout wired to `startBackgroundServices`, with every start recorded. */
async function services(preferences: Record<string, unknown>, quota?: QuotaSource) {
  const config = await mkdtemp(join(tmpdir(), 'framework-concurrency-cfg-'))
  const project = await mkdtemp(join(tmpdir(), 'framework-concurrency-proj-'))
  // A real git checkout whose tickets and queue live on the data branch (#1582), because the
  // drain claims each entry's ticket with a committed `.lock.md` before its agent starts (#1420)
  // — in a bare directory that cycle would fail and the whole batch would be dropped.
  await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
  await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
  await git('git', ['config', 'user.name', 'Test'], { cwd: project })
  await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
  const seeded = await withDataBranch(project, 'seed', async dir => {
    await mkdir(join(dir, 'tickets'), { recursive: true })
    for (const entry of QUEUE_ENTRIES) {
      const ticket = /\((tickets\/[^)]+)\)/.exec(entry)![1]!
      await writeFile(join(dir, ticket), `# ${ticket}\n`)
    }
    await writeFile(
      join(dir, 'TODO_AGENTS.md'),
      ['# TODO_AGENTS', '', '## Priority 9', '', ...QUEUE_ENTRIES.map(entry => `- ${entry}`), ''].join('\n'),
    )
  })
  assert.ok(seeded.ok, 'the fixture queue must land on the data branch')
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
    activeAgentCount: () => starts.length,
    busyAgentIds: () => new Set<string>(),
    projectErrors: projectErrorStore(),
    log: () => {},
  })
  const stop = async () => {
    // Awaited: the sweep in flight is what the cleanup below would otherwise delete out from under.
    await started.quiesce()
    await rm(config, { recursive: true, force: true })
    await rm(project, { recursive: true, force: true })
  }
  return { starts, stop, services: started, projectDir: project }
}

/** Poll until `check` holds or the deadline passes; the sweep is fired and not awaited. */
async function settle(check: () => boolean, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
}

test('the concurrency setting on disk is the number of agents the routine spins up (#1204)', async () => {
  // Four, so a pass cannot be the shipped default of two or a hardwired one.
  const { starts, stop, services: running, projectDir } = await services({ autoPm: true, autoPmConcurrency: 4 })
  try {
    // No wake call: the daemon sweeps once on start-up, which is the path a machine booted with
    // the setting already on actually takes.
    await settle(() => starts.length >= 4)
    assert.equal(starts.length, 4, 'the batch is the setting, not the default and not the queue length')
    // One entry each, in queue order: this is what makes four agents do disjoint work rather than
    // four copies of the first entry. The prompt is where the pin lives (E2) — it used to also
    // ride the agent's meta, so a third claim mechanism could be re-derived from it later.
    for (const [index, start] of starts.entries()) {
      assert.match(start.prompt, /Work on this one open task-queue entry only/)
      assert.ok(start.prompt.includes(QUEUE_ENTRIES[index]!), `the prompt pins ${QUEUE_ENTRIES[index]}`)
      // Nobody is at the keyboard, so a gate must auto-answer rather than park (#846/#1279).
      assert.equal(start.options.unattended, true)
      // The drain job lands its own PRs (#1216): the job's flag rides the start as the ladder's
      // top rung, so it reaches the agent already meaning "push, open, merge".
      assert.equal(start.options.handoff, 'merge')
      // A drain implements its ticket, so its PR title may close the issue — planAgent is only
      // for the fanned-out planners (#1327), whose merge must not.
      assert.equal(start.options.planAgent, undefined)
      assert.equal(start.projectId, 'proj-1')
    }
    // The ticket the entry links to rides along, so the four agents land in four lanes (#1117).
    assert.deepEqual(
      starts.map(s => s.options.ticket),
      ['tickets/2026-07-01_one.md', 'tickets/2026-07-01_two.md', 'tickets/2026-07-01_three.md', 'tickets/2026-07-01_four.md'],
    )
    // And the dashboard is told the batch went out, rather than only the first of it (#1161).
    const outcome = running.autoPmReport().outcomes[0]
    assert.equal(outcome?.started, true)
    assert.match(outcome?.message ?? '', /started 4 agents/)
    // The claim the sweep committed ahead of each agent (#1420): the ticket's lock is on the
    // data branch (#1582) and names the id the agent's own prompt carries as its own.
    const lock = await readFile(join(dataWorktreePath(projectDir), 'tickets/2026-07-01_one.lock.md'), 'utf8')
    assert.ok(lock.startsWith('CLAIMED: drain-'), "the first entry's ticket carries a drain claim")
    assert.ok(starts[0]!.prompt.includes(lock.trim()), 'and the prompt names that exact claim')
  } finally {
    await stop()
  }
})

test("the drain row's Run now fans out to the setting with auto-run off (#1204/#1210)", async () => {
  const { starts, stop, services: running } = await services({ autoPm: false, autoPmConcurrency: 3 })
  try {
    // The start-up sweep reads the switch and stands down; the click is what asks.
    await settle(() => starts.length > 0, 300)
    assert.equal(starts.length, 0, 'auto-run off means the schedule starts nothing by itself')
    // Exactly what the card's Run now sends for the draining routine, through the same
    // `wakeAutoPm` seam the RPC calls.
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    await settle(() => starts.length >= 3)
    assert.equal(starts.length, 3, 'the click spins the setting up, not one agent')
    for (const [index, start] of starts.entries()) {
      assert.ok(start.prompt.includes(QUEUE_ENTRIES[index]!), `the prompt pins ${QUEUE_ENTRIES[index]}`)
    }
  } finally {
    await stop()
  }
})

/** An archived meta in the transient `.the-framework/agents/`, where the promote poll reads it. */
async function archiveMeta(projectDir: string, meta: { id: string } & Record<string, unknown>): Promise<void> {
  const dir = join(projectDir, '.the-framework', 'agents')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${meta.id}.json`), JSON.stringify({ startedAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:01:00.000Z', ...meta }))
}

test('a drained entry is checked off on the data branch once its run reports the work published (#1582)', async () => {
  // The whole retire loop, with only the agent stubbed: the sweep pins the entry, the run's
  // archived record reports the hand-off, and the daemon — the queue's one local writer — lands
  // the check-off as a data-branch commit. The agent never touches the queue.
  const { starts, stop, services: running, projectDir } = await services({ autoPm: false, autoPmConcurrency: 1 })
  try {
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    await settle(() => starts.length >= 1)
    assert.ok(starts[0]!.prompt.includes(QUEUE_ENTRIES[0]!), 'the first entry is the pinned one')
    // The run settles `done` and its epilogue reported the push/PR: the one ending that retires.
    await archiveMeta(projectDir, { id: 'run-1', status: 'done', handoffReport: 'done' })
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    // Waited for on the branch, not the checkout file: the funnel writes the file first and
    // commits a beat later, and only the commit is the retirement every machine pulls.
    const deadline = Date.now() + 5000
    let subjects = ''
    while (Date.now() < deadline) {
      subjects = await git('git', ['log', '--format=%s', 'tf-data'], { cwd: projectDir }).then(r => r.stdout, () => '')
      if (subjects.includes('check off a drained entry')) break
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.ok(subjects.includes('check off a drained entry'), 'the check-off is a data-branch commit')
    const queue = await readFile(join(dataWorktreePath(projectDir), 'TODO_AGENTS.md'), 'utf8')
    assert.ok(queue.includes(`- [x] ${QUEUE_ENTRIES[0]!}`), 'the drained entry is checked off')
    // The fixture seeds bare bullets, and untouched ones must stay exactly as written.
    assert.ok(queue.includes(`- ${QUEUE_ENTRIES[1]!}`), 'the untouched entries stay open')
    assert.ok(!queue.includes(`[x] ${QUEUE_ENTRIES[1]!}`), 'only the drained entry is retired')
  } finally {
    await stop()
  }
})

test('a run whose hand-off failed leaves its entry open: unpublished work is not retired (#1582)', async () => {
  // The negative half of the gate above, seen live in the PR smoke: the push or PR did not land
  // (`handoffReport: 'failed'`), so the daemon settles the run without checking anything off —
  // the entry stays open for the next drain rather than vanishing with the work unpublished.
  const { starts, stop, services: running, projectDir } = await services({ autoPm: false, autoPmConcurrency: 1 })
  try {
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    await settle(() => starts.length >= 1)
    await archiveMeta(projectDir, { id: 'run-1', status: 'done', handoffReport: 'failed' })
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    // No positive signal marks "the promote settled without retiring", so give the tick a
    // moment and then require the queue untouched — the check-off in the sibling test lands
    // well inside this window when the gate passes.
    await settle(() => false, 1500)
    const queue = await readFile(join(dataWorktreePath(projectDir), 'TODO_AGENTS.md'), 'utf8')
    assert.ok(!queue.includes('[x]'), 'nothing is checked off')
    assert.ok(queue.includes(`- ${QUEUE_ENTRIES[0]!}`), "the failed run's entry stays open")
  } finally {
    await stop()
  }
})

test('a drain claims an entry whose ticket file is gone, recreating tickets/ on the way (#1582)', async () => {
  // The live-smoke regression: retiring the last ticket removes `tickets/` itself (git keeps no
  // empty dirs), while the queue entry linking it stays open — a failed publish leaves exactly
  // this state. The next drain must still claim and start, not stand the batch down with
  // "another agent already claimed".
  const { starts, stop, services: running, projectDir } = await services({ autoPm: false, autoPmConcurrency: 1 })
  try {
    const cleared = await withDataBranch(projectDir, 'retire every ticket', async dir => {
      await rm(join(dir, 'tickets'), { recursive: true, force: true })
    })
    assert.ok(cleared.ok, 'the fixture must drop tickets/ from the data branch')
    running.wakeAutoPm({ onDemand: true, only: 'drain' })
    await settle(() => starts.length >= 1)
    assert.equal(starts.length, 1, 'the batch starts instead of standing down')
    assert.ok(starts[0]!.prompt.includes(QUEUE_ENTRIES[0]!), 'the first entry is the pinned one')
    const lock = await readFile(join(dataWorktreePath(projectDir), 'tickets/2026-07-01_one.lock.md'), 'utf8')
    assert.ok(lock.startsWith('CLAIMED: drain-'), 'the claim landed in a recreated tickets/')
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
    assert.ok(logs.some(m => m.includes('data branch sync')), 'still said on the daemon log too')

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
  const { starts, stop, services: running } = await services({ autoPm: true, autoPmConcurrency: 4, model: 'claude-fable-5' }, quota)
  try {
    // Waited on the sweep's own report rather than a bare delay: the assertion is that the pass ran
    // and decided not to start, which a timeout could not tell from a pass that had not run yet.
    await settle(() => running.autoPmReport().outcomes.length > 0)
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
  const { starts, stop } = await services({ autoPm: true, autoPmConcurrency: 2, model: 'claude-opus-5' }, quota)
  try {
    await settle(() => starts.length >= 2)
    assert.equal(starts.length, 2, 'the batch goes out as usual')
    assert.equal(starts[0]!.options.model, 'claude-opus-5', 'and on the model the gate was measured for')
  } finally {
    await stop()
  }
})
