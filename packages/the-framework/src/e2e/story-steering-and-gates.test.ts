import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { makeWorld, waitFor, withFakeAwait } from './harness.js'
import { archivedAgentPaths } from '../store/index.js'
import { onOpenQuestions, onAgents, onRetainedWorktrees, onAgentWorktree } from '../dashboard-rpc/reads.js'
import {
  sendChoice,
  sendMessage,
  sendStop,
  sendSetHandoff,
  sendDeleteAgent,
} from '../dashboard-rpc/control.js'

// The steering stories (README.md): everything the user does TO a live session — answer its
// question, chat with it, change its handoff, stop it — flows browser -> RPC -> control.jsonl ->
// the agent process, and the observable answer comes back through the agent's own event log.

test('answer a parked session’s question from the questions hub (#304/#1455)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const agentId = await withFakeAwait('choices', () => world.startAgent(project, 'Wire up auth'))
    const tail = await world.tailAgent(project, agentId)

    // The agent parks: the full gate (title, options, recommendation) reaches the feed, and the
    // cross-project questions hub lists it against this session.
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    assert.equal(gate.kind, 'choice')
    if (gate.kind !== 'choice') return
    assert.ok(gate.options.length >= 2, 'the gate offers options')
    assert.ok(gate.recommended, 'the gate names a recommended option')
    const question = await waitFor(
      async () => (await rpc(onOpenQuestions)()).find(q => q.agentId === agentId),
      'the questions hub to list the parked run',
    )
    assert.equal(question.projectId, project.id)
    assert.equal(question.choice.id, gate.id)
    assert.deepEqual(question.choice.options.map(o => o.id), gate.options.map(o => o.id))

    // The user picks the recommended option. The agent records who answered and carries on to done.
    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', agentId)
    const resolved = await waitFor(() => tail.events.find(e => e.kind === 'choice-resolved'), 'the resolution event')
    assert.equal(resolved.kind === 'choice-resolved' && resolved.picked, gate.recommended)
    assert.equal(resolved.kind === 'choice-resolved' && resolved.by, 'user')
    await world.waitAgent(project, agentId, 'done')

    // Answered means gone from the hub.
    assert.equal((await rpc(onOpenQuestions)()).some(q => q.agentId === agentId), false)
  } finally {
    await world.close()
  }
})

test('chat with a live session: a message becomes the next agent turn (#714)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const agentId = await withFakeAwait('choices', () => world.startAgent(project, 'Build the dashboard page'))
    const tail = await world.tailAgent(project, agentId)
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    if (gate.kind !== 'choice') return

    // Said while the session is parked, so the queue provably holds it until the gate resolves.
    await rpc(sendMessage)(project.id, 'Also add a logout button', agentId)
    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', agentId)

    // The queued message is drained as its own turn: its text shows up as a driver prompt on the
    // feed the transcript renders.
    await waitFor(
      () =>
        tail.events.find(
          e => e.kind === 'driver' && e.event.type === 'start' && e.event.prompt.includes('Also add a logout button'),
        ),
      'the chat message to become an agent turn',
    )
    await world.waitAgent(project, agentId, 'done')
    await world.waitRetired(project, agentId)

    // What was said survives the session (#1179): teardown archives the agent's event log into the
    // project checkout, where the daemon's committer picks it up, so a clone carries the exchange
    // and not just the fact an agent happened. The event log *is* that record (B3) — a second, prose
    // re-narration used to be committed beside it, which is what the Discord mirror then polled and
    // diffed instead of reading this.
    const archived = await archivedAgentPaths(project.cwd, agentId)
    const events = archived.find(path => path.endsWith('.jsonl'))
    assert.ok(events, `expected an archived event log, got: ${JSON.stringify(archived)}`)
    const log = await readFile(events, 'utf8')
    assert.ok(log.includes('Also add a logout button'), 'the archived event log carries the message')
  } finally {
    await world.close()
  }
})

test('rearm the handoff mid-run; the meta a reloaded tab reads follows (#1102)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const agentId = await withFakeAwait('choices', () => world.startAgent(project, 'Refactor the config layer'))
    const tail = await world.tailAgent(project, agentId)
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    if (gate.kind !== 'choice') return

    // The box starts armed (the PR rung is the default), and unticking it mid-run re-announces the
    // armed state — the event is what folds onto the meta a tab opened later reads back.
    await rpc(sendSetHandoff)(project.id, agentId, 'local')
    await waitFor(
      () => tail.events.find(e => e.kind === 'handoff-armed' && !e.push && !e.pr),
      'the disarmed announcement',
    )
    const meta = await waitFor(async () => {
      const agent = (await rpc(onAgents)(project.id)).find(r => r.id === agentId)
      return agent?.handoff && !agent.handoff.push && !agent.handoff.pr ? agent : undefined
    }, 'the disarmed state to reach the run meta')
    assert.equal(meta.handoff?.push, false)
    assert.equal(meta.handoff?.pr, false)

    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', agentId)
    await world.waitAgent(project, agentId, 'done')
  } finally {
    await world.close()
  }
})

test('stop a session; its checkout is reclaimed once the work is on the remote, then deleted (#737/#1032/E5)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const agentId = await withFakeAwait('choices', () => world.startAgent(project, 'Long experiment'))
    const tail = await world.tailAgent(project, agentId)
    await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')

    // Stop while parked: the agent ends `stopped`, not failed — the user interrupted it.
    await rpc(sendStop)(project.id, agentId)
    const end = await waitFor(() => tail.events.find(e => e.kind === 'end'), 'the end event')
    assert.equal(end.kind === 'end' && end.stopped, true)
    tail.stop()
    await world.waitAgent(project, agentId, 'stopped')

    // One rule (E5): the checkout goes once its work is on the remote, whatever the session did.
    // A stopped agent used to keep it "for inspection", and nothing ever took those back — so a
    // machine accumulated one full checkout per stopped session until a human noticed. What was
    // stopped is not lost: the branch is on the remote, and `git worktree add` brings it back.
    await world.waitRetired(project, agentId)
    assert.deepEqual(await rpc(onRetainedWorktrees)(project.id), [])
    assert.equal((await rpc(onAgentWorktree)(project.id, agentId))?.own, false, 'no checkout of its own is left')
    assert.ok((await rpc(onAgents)(project.id)).some(r => r.id === agentId && r.status === 'stopped'), 'the session row survives')

    // Delete is the destructive sibling: the row itself disappears from the dashboard.
    const deleted = await rpc(sendDeleteAgent)(project.id, agentId)
    assert.equal(deleted.ok, true, `delete failed: ${'error' in deleted ? deleted.error : ''}`)
    assert.equal((await rpc(onAgents)(project.id)).some(r => r.id === agentId), false)
  } finally {
    await world.close()
  }
})
