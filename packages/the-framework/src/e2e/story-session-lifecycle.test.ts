import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { makeWorld, waitFor, withFakeAwait, git } from './harness.js'
import {
  onRun,
  onRuns,
  onRunHandoff,
  onRunWorktree,
  onRetainedWorktrees,
  onProjectLog,
  onActivity,
  onRecentRuns,
} from '../dashboard-rpc/reads.telefunc.js'
import { sendChoice, sendPushBranch } from '../dashboard-rpc/control.telefunc.js'

// The session lifecycle stories (README.md): what a user sees between clicking Start and reading
// the archived session row — through the same RPCs the dashboard calls, with real spawned run
// processes and the fake driver in the agent seat.

test('start a session, watch it live, and read the archived row when it ends', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const runId = await world.startRun(project, 'Add a login page', { handoff: 'local' })
    const tail = await world.tailRun(project, runId)

    // The live feed narrates the run the way the session view renders it: the session banner
    // first (naming the fake driver, so no real agent is running), then the agent's own turn.
    const session = await waitFor(
      () => tail.events.find(e => e.kind === 'session'),
      'the session event on the live feed',
    )
    assert.equal(session.kind === 'session' && session.fake, true)
    assert.equal(session.kind === 'session' && session.driver, 'fake')

    // The spawned child got exactly what the launcher's unticked handoff box says: the spawn is
    // detached, so the recorded spec is the only place this contract is observable. "Publish
    // nothing" is one named rung (B5) rather than a set of falses that each reader has to add up.
    const sent = (await world.spawnedSpecs())[0]!
    assert.equal(sent.options.handoff, 'local')
    assert.equal(sent.runId, runId, 'the child was handed its worktree run id')

    // The agent's turn reaches the feed: its tool actions, its reply, the accounted usage, and
    // the end marker — the exact sequence the transcript pane draws.
    await waitFor(() => tail.events.find(e => e.kind === 'end'), 'the end event')
    const kinds = tail.events.map(e => e.kind)
    assert.ok(kinds.indexOf('session') < kinds.indexOf('end'), 'session precedes end')
    const usage = tail.events.find(e => e.kind === 'usage')
    assert.ok(usage && usage.kind === 'usage' && usage.inputTokens > 0, 'usage accounting reached the feed')
    const end = tail.events.find(e => e.kind === 'end')
    assert.equal(end?.kind === 'end' && end.ok, true)
    tail.stop()

    // The sidebar row settles to done, carrying what the list renders: the prompt as the label,
    // the branch the work is on, and the driver that ran it.
    const meta = await world.waitRun(project, runId, 'done')
    assert.equal(meta.intent, 'Add a login page')
    assert.equal(meta.branch, `the-framework/run-${runId}`)
    assert.equal(meta.driver, 'fake')

    // A cleanly finished session retires its worktree (#737): nothing left to inspect, so the
    // checkout is gone from disk, the Remove list is empty, and the run addresses the project root.
    await world.waitRetired(project, runId)
    assert.deepEqual(await rpc(onRetainedWorktrees)(project.id), [])
    const worktree = await rpc(onRunWorktree)(project.id, runId)
    assert.equal(worktree?.own, false)

    // The archived history replays the same story the live tail told (#1472 reads the run's own
    // journal, not another run's), and the cross-project surfaces list the session.
    const replay = await rpc(onRun)(project.id, runId)
    assert.ok(replay.some(e => e.kind === 'session') && replay.some(e => e.kind === 'end'), 'replay has the whole journal')
    const activity = await rpc(onActivity)()
    assert.ok(activity.some(a => a.runId === runId && a.kind === 'finished' && a.status === 'done'))
    const recent = await rpc(onRecentRuns)()
    assert.ok(recent.some(r => r.projectId === project.id && r.run.id === runId))

    // The session's record rides its branch, not main: teardown commits the LOGS.md line and the
    // conversation to the run branch, so the handoff panel sees a branch of pure bookkeeping
    // (#1291 calls that `empty` — nothing publishable) while the committed project log stays a
    // projection of main and shows the line only once the branch merges.
    const handoff = await rpc(onRunHandoff)(project.id, runId)
    assert.equal(handoff?.exists, true)
    assert.equal(handoff?.empty, true)
    assert.deepEqual(await rpc(onProjectLog)(project.id), [])
  } finally {
    await world.close()
  }
})

test('two sessions run concurrently, each in its own worktree (#736)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    // Both runs park on their scripted question, so both are provably alive at the same time —
    // the one-working-tree collision #736 removed would have refused the second Start.
    const [runA, runB] = await withFakeAwait('choices', async () => {
      const a = await world.startRun(project, 'First feature')
      const b = await world.startRun(project, 'Second feature')
      return [a, b]
    })
    assert.notEqual(runA, runB)

    const tailA = await world.tailRun(project, runA)
    const tailB = await world.tailRun(project, runB)
    const gateA = await waitFor(() => tailA.events.find(e => e.kind === 'choice'), 'run A to park on its gate')
    const gateB = await waitFor(() => tailB.events.find(e => e.kind === 'choice'), 'run B to park on its gate')

    // Both rows are live in the sidebar, and each names its own checkout under the project's
    // worktrees dir — the user's checkout is neither.
    const runs = await rpc(onRuns)(project.id)
    assert.equal(runs.filter(r => [runA, runB].includes(r.id) && r.status === 'running').length, 2)
    const [wtA, wtB] = [await rpc(onRunWorktree)(project.id, runA), await rpc(onRunWorktree)(project.id, runB)]
    assert.equal(wtA?.own, true)
    assert.equal(wtB?.own, true)
    assert.notEqual(wtA?.path, wtB?.path)
    assert.equal(world.runtime.activeRunCount(project.id), 2)

    // Answering each question lets each session finish independently.
    for (const [runId, gate] of [
      [runA, gateA],
      [runB, gateB],
    ] as const) {
      assert.equal(gate.kind, 'choice')
      if (gate.kind !== 'choice') continue
      await rpc(sendChoice)(project.id, gate.id, gate.recommended ?? gate.options[0]!.id, 'user', runId)
      const meta = await world.waitRun(project, runId, 'done')
      assert.equal(meta.status, 'done')
    }
    // Eventually, not instantly: the meta flips to done a beat before the daemon reaps the
    // child's exit, and until the reap the pid still answers as alive.
    await waitFor(
      () => (world.runtime.activeRunCount(project.id) === 0 ? true : undefined),
      'the daemon to reap both finished runs',
    )
  } finally {
    await world.close()
  }
})

test("publish a finished session: push its branch from the handoff panel (#799)", async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    // A real remote for the story: a bare repo standing in for origin, so the push is a real
    // git push and the handoff panel's pushed flag comes from the remote, not from a stub.
    const remote = join(world.home, 'origin.git')
    await git(world.home, 'init', '-q', '--bare', remote)
    await git(project.cwd, 'remote', 'add', 'origin', remote)

    const runId = await world.startRun(project, 'Ship the settings page', { handoff: 'local' })
    await world.waitRun(project, runId, 'done')

    // Pushed the instant the row flips done — deliberately INSIDE teardown's window. This used
    // to race teardown's own commits in the same checkout: the click failed with "could not
    // commit the work this session left uncommitted" and teardown stranded the worktree. The
    // run lock serializes the two, so the first click works and teardown still retires cleanly.
    const pushed = await rpc(sendPushBranch)(project.id, runId)
    assert.equal(pushed.ok, true, `push failed: ${'error' in pushed ? pushed.error : ''}`)
    const remoteBranches = await git(project.cwd, 'ls-remote', '--heads', 'origin')
    assert.ok(remoteBranches.includes(`the-framework/run-${runId}`), 'the run branch is on origin')
    await world.waitRetired(project, runId)
    assert.deepEqual(await rpc(onRetainedWorktrees)(project.id), [], 'the concurrent push must not strand the worktree')

    // The handoff panel agrees: branch on the remote, session record included.
    const after = await waitFor(async () => {
      const handoff = await rpc(onRunHandoff)(project.id, runId)
      return handoff?.pushed ? handoff : undefined
    }, 'the panel to report the branch pushed')
    assert.equal(after.branch, `the-framework/run-${runId}`)
    assert.equal(after.exists, true)
    assert.equal(after.hasRemote, true)
  } finally {
    await world.close()
  }
})
