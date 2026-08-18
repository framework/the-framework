import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { startBackgroundServices } from './daemon-services.js'
import { quotaBoundaryStatus } from './quota-boundary.js'
import type { QuotaSource, QuotaView } from './dashboard/quota.js'
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

/** A reading with room to spare, so the quota gate is never the reason a start did not happen. */
function spareQuota(): QuotaSource {
  // Placed against the real clock, since the sweep's own `now` is not injectable from here: the
  // week resets four days out, so ~43% of it has elapsed and 1% used is nowhere near the line.
  const resets = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][resets.getUTCMonth()]
  const windows = [
    {
      label: 'Current week (all models)',
      kind: 'week' as const,
      percentUsed: 1,
      resetsAtText: `${month} ${resets.getUTCDate()} at 7am (UTC)`,
    },
  ]
  const boundary = quotaBoundaryStatus({ windows, now: Date.now() })
  if (!boundary) throw new Error('the fixture week should be placeable')
  const view: QuotaView = { windows, boundary, readAt: Date.now() }
  return { read: async () => view, stop: () => {} }
}

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

/** A registry + checkout wired to `startBackgroundServices`, with every start recorded. */
async function services(preferences: Record<string, unknown>) {
  const config = await mkdtemp(join(tmpdir(), 'framework-concurrency-cfg-'))
  const project = await mkdtemp(join(tmpdir(), 'framework-concurrency-proj-'))
  // A real git checkout with real tickets, because the drain claims each entry's ticket with a
  // committed `.lock.md` before its agent starts (#1420) — in a bare directory that commit would
  // fail and the whole batch would be dropped as claimed elsewhere.
  await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
  await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
  await git('git', ['config', 'user.name', 'Test'], { cwd: project })
  await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
  await mkdir(join(project, 'tickets'))
  for (const entry of QUEUE_ENTRIES) {
    const ticket = /\((tickets\/[^)]+)\)/.exec(entry)![1]!
    await writeFile(join(project, ticket), `# ${ticket}\n`)
  }
  await writeFile(
    join(config, 'the-framework.json'),
    JSON.stringify({
      projects: [{ id: 'proj-1', path: project, addedAt: '2026-07-27T00:00:00.000Z' }],
      preferences,
    }),
  )
  await writeFile(
    join(project, 'TODO_AGENTS.md'),
    ['# TODO_AGENTS', '', '## Priority 9', '', ...QUEUE_ENTRIES.map(entry => `- ${entry}`), ''].join('\n'),
  )
  const starts: { prompt: string; options: StartAgentOptions; projectId: string }[] = []
  const started = startBackgroundServices({
    cwd: project,
    env: { XDG_CONFIG_HOME: config },
    dashboardUrl: 'http://localhost:4000',
    quota: spareQuota(),
    startAgent: async (prompt, options, projectId): Promise<StartAgentResult> => {
      starts.push({ prompt, options, projectId })
      return { ok: true, agentId: `run-${starts.length}` }
    },
    // What the daemon's own counter reports: the agents this sweep has asked for are live, so the
    // cap is measured against them rather than against a constant zero.
    activeAgentCount: () => starts.length,
    busyAgentIds: () => new Set<string>(),
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
      assert.match(start.prompt, /work on this one open entry only/)
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
    // The claim the sweep committed ahead of each agent (#1420): the ticket's lock is on disk
    // and names the id the agent's own prompt carries as its own.
    const lock = await readFile(join(projectDir, 'tickets/2026-07-01_one.lock.md'), 'utf8')
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
    running.wakeAutoPm({ onDemand: true, drainOnly: true })
    await settle(() => starts.length >= 3)
    assert.equal(starts.length, 3, 'the click spins the setting up, not one agent')
    for (const [index, start] of starts.entries()) {
      assert.ok(start.prompt.includes(QUEUE_ENTRIES[index]!), `the prompt pins ${QUEUE_ENTRIES[index]}`)
    }
  } finally {
    await stop()
  }
})
