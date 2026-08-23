import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeWorld, waitFor, withFakeAwait, git } from './harness.js'
import {
  onAgent,
  onAgents,
  onAgentHandoff,
  onAgentWorktree,
  onRetainedWorktrees,
  onActivity,
  onRecentAgents,
} from '../dashboard-rpc/reads.js'
import { sendChoice, sendPushBranch } from '../dashboard-rpc/control.js'

// The session lifecycle stories (README.md): what a user sees between clicking Start and reading
// the archived session row — through the same RPCs the dashboard calls, with real spawned run
// processes and the fake driver in the agent seat.

test('start a session, watch it live, and read the archived row when it ends', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const agentId = await world.startAgent(project, 'Add a login page', { handoff: 'local' })
    const tail = await world.tailAgent(project, agentId)

    // The live feed narrates the agent the way the session view renders it: the session banner
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
    assert.equal(sent.agentId, agentId, 'the child was handed its worktree run id')

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
    const meta = await world.waitAgent(project, agentId, 'done')
    assert.equal(meta.intent, 'Add a login page')
    assert.equal(meta.branch, `tf-agent-${agentId}`)
    assert.equal(meta.driver, 'fake')

    // A publish-nothing session keeps its checkout (B5): retiring one means pushing its branch,
    // and that push is the publish the `local` rung exists to refuse. So the checkout stays on
    // the Remove list, nothing reaches origin, and the agent still addresses its own worktree.
    // (The clean retire-on-finish story lives in the publish test below, where pushing is armed.)
    await waitFor(
      async () => ((await rpc(onRetainedWorktrees)(project.id)).includes(agentId) ? true : undefined),
      'the kept worktree to reach the Remove list',
    )
    const remoteBranches = await git(project.cwd, 'ls-remote', '--heads', 'origin')
    assert.ok(!remoteBranches.includes(`tf-agent-${agentId}`), 'publish nothing: the branch never reached origin')
    const worktree = await rpc(onAgentWorktree)(project.id, agentId)
    assert.equal(worktree?.own, true)

    // The archived history replays the same story the live tail told (#1472 reads the agent's own
    // journal, not another agent's), and the cross-project surfaces list the session. Waited for,
    // not read once: a kept checkout reaches the Remove list the moment its meta flips done, while
    // the archive lands later in teardown — as a data-branch commit since #1582, a full git cycle
    // rather than the old file copy, so the read would otherwise race it.
    const replay = await waitFor(async () => {
      const events = await rpc(onAgent)(project.id, agentId)
      return events.some(e => e.kind === 'session') && events.some(e => e.kind === 'end') ? events : undefined
    }, 'the archived replay to carry the whole journal')
    assert.ok(replay.some(e => e.kind === 'session') && replay.some(e => e.kind === 'end'), 'replay has the whole journal')
    const activity = await rpc(onActivity)()
    assert.ok(activity.items.some(a => a.agentId === agentId && a.kind === 'finished' && a.status === 'done'))
    // The feed also names the project as read whole, which is what lets the browser's notifier tell
    // this apart from a poll that simply could not reach it (#1625).
    assert.ok(activity.whole.includes(project.id))
    const recent = await rpc(onRecentAgents)()
    assert.ok(recent.some(r => r.projectId === project.id && r.agent.id === agentId))

    // The session's record rides its branch, not main: teardown commits the archive to the agent
    // branch, so the handoff panel sees a branch of pure bookkeeping — #1291 calls that `empty`,
    // meaning nothing publishable.
    const handoff = await rpc(onAgentHandoff)(project.id, agentId)
    assert.equal(handoff?.exists, true)
    assert.equal(handoff?.empty, true)
  } finally {
    await world.close()
  }
})

test('two sessions run concurrently, each in its own worktree (#736)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    // Both agents park on their scripted question, so both are provably alive at the same time —
    // the one-working-tree collision #736 removed would have refused the second Start.
    const [runA, runB] = await withFakeAwait('choices', async () => {
      const a = await world.startAgent(project, 'First feature')
      const b = await world.startAgent(project, 'Second feature')
      return [a, b]
    })
    assert.notEqual(runA, runB)

    const tailA = await world.tailAgent(project, runA)
    const tailB = await world.tailAgent(project, runB)
    const gateA = await waitFor(() => tailA.events.find(e => e.kind === 'choice'), 'run A to park on its gate')
    const gateB = await waitFor(() => tailB.events.find(e => e.kind === 'choice'), 'run B to park on its gate')

    // Both rows are live in the sidebar, and each names its own checkout under the project's
    // worktrees dir — the user's checkout is neither.
    const agents = await rpc(onAgents)(project.id)
    assert.equal(agents.filter(r => [runA, runB].includes(r.id) && r.status === 'running').length, 2)
    const [wtA, wtB] = [await rpc(onAgentWorktree)(project.id, runA), await rpc(onAgentWorktree)(project.id, runB)]
    assert.equal(wtA?.own, true)
    assert.equal(wtB?.own, true)
    assert.notEqual(wtA?.path, wtB?.path)
    // Both slots name their run and its process (#1646): the count is derived, the names are what
    // the sweep says when it stands down against them.
    const slots = world.runtime.activeAgentSlots(project.id)
    assert.deepEqual(slots.map(slot => [slot.agentId, slot.state, typeof slot.pid]).sort(), [
      [runA, 'live', 'number'],
      [runB, 'live', 'number'],
    ].sort())

    // Answering each question lets each session finish independently.
    for (const [agentId, gate] of [
      [runA, gateA],
      [runB, gateB],
    ] as const) {
      assert.equal(gate.kind, 'choice')
      if (gate.kind !== 'choice') continue
      await rpc(sendChoice)(project.id, gate.id, gate.recommended ?? gate.options[0]!.id, 'user', agentId)
      const meta = await world.waitAgent(project, agentId, 'done')
      assert.equal(meta.status, 'done')
    }
    // Eventually, not instantly: the meta flips to done a beat before the daemon reaps the
    // child's exit, and until the reap the pid still answers as alive.
    await waitFor(
      () => (world.runtime.activeAgentSlots(project.id).length === 0 ? true : undefined),
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
    // The fixture already carries a bare `origin` (the harness gives every project one, since the
    // retention rule is about the remote), so the push here is a real git push and the handoff
    // panel's pushed flag comes from the remote rather than from a stub. Push-armed, so teardown
    // is a pusher too (a fake run's own handoff always skips): that is the collision under test.
    const agentId = await world.startAgent(project, 'Ship the settings page', { handoff: 'push' })
    await world.waitAgent(project, agentId, 'done')

    // Pushed the instant the row flips done — deliberately INSIDE teardown's window. This used
    // to race teardown's own commits in the same checkout: the click failed with "could not
    // commit the work this session left uncommitted" and teardown stranded the worktree. Then it
    // raced teardown's *push* instead, once only the commit was serialized: both sides created
    // the same ref and the loser got `cannot lock ref … reference already exists`, which when
    // teardown lost meant the worktree was kept. The agent lock spans commit and push on both
    // sides, so the first click works and teardown still retires cleanly.
    const pushed = await rpc(sendPushBranch)(project.id, agentId)
    assert.equal(pushed.ok, true, `push failed: ${'error' in pushed ? pushed.error : ''}`)
    const remoteBranches = await git(project.cwd, 'ls-remote', '--heads', 'origin')
    assert.ok(remoteBranches.includes(`tf-agent-${agentId}`), 'the run branch is on origin')
    await world.waitRetired(project, agentId)
    assert.deepEqual(await rpc(onRetainedWorktrees)(project.id), [], 'the concurrent push must not strand the worktree')

    // The handoff panel agrees: branch on the remote, session record included.
    const after = await waitFor(async () => {
      const handoff = await rpc(onAgentHandoff)(project.id, agentId)
      return handoff?.pushed ? handoff : undefined
    }, 'the panel to report the branch pushed')
    assert.equal(after.branch, `tf-agent-${agentId}`)
    assert.equal(after.exists, true)
    assert.equal(after.hasRemote, true)
  } finally {
    await world.close()
  }
})
