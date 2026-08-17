import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { makeWorld, waitFor } from './harness.js'
import { onProjects, sendAddProject } from '../dashboard-rpc/projects.js'
import { onGitStatus, onAgents, onDocs } from '../dashboard-rpc/reads.js'
import { onPreferences, patchPreferences } from '../dashboard-rpc/preferences.js'
import { onQuota, onAutoPm, sendAutoPmSweep } from '../dashboard-rpc/quota.js'
import { sendStart } from '../dashboard-rpc/control.js'

// The projects & settings stories (README.md): registering a repo, what the sidebar then shows,
// how settings written in the dashboard reach the agents the daemon starts, and the usage panel.

test('add a project: it is installed, registered, and readable like the sidebar reads it (#396)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()

    // Install left its marks in the repo: the framework directory and its ignore file, which is
    // the one file install writes and commits (B3).
    await stat(join(project.cwd, '.the-framework', '.gitignore'))

    // The Projects sidebar shows the repo as an activated project.
    const projects = await rpc(onProjects)()
    const mine = projects.find(p => p.id === project.id)
    assert.equal(mine?.path, project.cwd)
    assert.equal(mine?.activated, true)

    // The project header's reads answer: the branch, an empty docs rail, an empty agent history.
    const status = await rpc(onGitStatus)(project.id)
    assert.equal(status?.branch, 'main')
    assert.deepEqual(await rpc(onDocs)(project.id), [])
    assert.deepEqual(await rpc(onAgents)(project.id), [])

    // Adding the same repo again is a no-op the dialog can explain, not a duplicate.
    const again = await rpc(sendAddProject)(project.cwd, false)
    assert.deepEqual(again, { ok: true, added: 0, alreadyActivated: 1 })
    assert.equal((await rpc(onProjects)()).filter(p => p.id === project.id).length, 1)

    // A bogus path is refused with a reason, not a crash.
    const bogus = await rpc(sendAddProject)(join(world.home, 'nope'), false)
    assert.equal(bogus.ok, false)
  } finally {
    await world.close()
  }
})

test('unknown projects degrade quietly: reads are empty, writes are refused (#427)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    await world.addProject()
    assert.deepEqual(await rpc(onAgents)('no-such-project'), [])
    assert.equal(await rpc(onGitStatus)('no-such-project'), null)
    const refused = await rpc(sendStart)('no-such-project', 'do something')
    assert.equal(refused.ok, false)
  } finally {
    await world.close()
  }
})

test('settings written in the dashboard reach the next resumed run (#858/#1467)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()

    // The Settings page: patch your settings and read them back. One writable tier (B5) — the
    // repo's committed the-framework.yml is the other, and it is edited in the repo.
    const patched = await rpc(patchPreferences)({ vanilla: false, model: 'fable-e2e' })
    assert.equal(patched.ok, true)
    assert.equal((await rpc(onPreferences)()).vanilla, false)
    assert.equal((await rpc(onPreferences)()).model, 'fable-e2e')

    // First leg: a plain agent, finished.
    const agentId = await world.startAgent(project, 'Build the settings page')
    await world.waitAgent(project, agentId, 'done')

    // The composer's Resume sends only its seed (#1467); the daemon overlays the project's
    // resolved options, so the model chosen in Settings reaches the continued session's argv.
    // Fired the instant the row flips done — deliberately inside teardown's window: the busy
    // guard waits out the still-exiting first leg instead of refusing (#1529), and the agent
    // lock makes the continuation wait out the archive it is about to reopen, where it used
    // to reuse a checkout mid-retirement.
    const resumed = await rpc(sendStart)(project.id, 'Keep going', 'prompt', { continueAgentId: agentId })
    assert.equal(resumed.ok, true, `the resume was refused: ${JSON.stringify(resumed)}`)
    await world.waitAgent(project, agentId, 'done')
    await world.waitRetired(project, agentId)
    const sent = await waitFor(async () => {
      const spawns = await world.spawnedSpecs()
      return spawns.length >= 2 ? spawns[1] : undefined
    }, 'the resumed child to be spawned')
    assert.equal(sent.options.model, 'fable-e2e', 'the resumed run carries the project model')
    assert.equal(sent.continueAgent, true, 'the resumed run reopens the same session row')

    // One row throughout: the continuation is the same agent, not a second history entry.
    const rows = await rpc(onAgents)(project.id)
    assert.equal(rows.filter(r => r.id === agentId).length, 1)
  } finally {
    await world.close()
  }
})

test('the usage panel reads the daemon quota source, and the sweep button fires a sweep (#533/#1210)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    // No reading: the panel must hear "unavailable", never an empty bar that reads as unused.
    world.quota.view = { windows: [], unavailable: 'fetch-failed' }
    assert.equal((await rpc(onQuota)()).unavailable, 'fetch-failed')

    // With a reading, the windows come through as the poller reported them.
    world.quota.view = {
      windows: [{ label: 'Current week (all models)', usedPercent: 40 } as never],
      readAt: 123,
    }
    const quota = await rpc(onQuota)()
    assert.equal(quota.windows.length, 1)
    assert.equal(quota.readAt, 123)

    // The auto-PM line under the toggle: silent before the first sweep, then the report.
    assert.equal(await rpc(onAutoPm)(), undefined)
    world.autoPm.report = { nextSweepAt: 456, outcomes: [] }
    assert.deepEqual(await rpc(onAutoPm)(), { nextSweepAt: 456, outcomes: [] })

    // The "sweep now" button reaches the daemon's loop and reports the outcomes it recorded.
    world.autoPm.report = {
      nextSweepAt: 789,
      outcomes: [{ projectId: 'p', path: '/p', started: false, message: 'the queue is empty' }],
    }
    const swept = await rpc(sendAutoPmSweep)({ drainOnly: true })
    assert.deepEqual(world.autoPm.sweeps, [{ drainOnly: true }])
    assert.equal(swept.ok, true)
    assert.equal(swept.outcomes?.[0]?.message, 'the queue is empty')
  } finally {
    await world.close()
  }
})
