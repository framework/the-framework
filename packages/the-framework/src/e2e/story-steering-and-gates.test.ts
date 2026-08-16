import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { makeWorld, waitFor, withFakeAwait } from './harness.js'
import { archivedRunPaths } from '../store/index.js'
import { onOpenQuestions, onRuns, onRetainedWorktrees, onRunWorktree } from '../dashboard-rpc/reads.js'
import {
  sendChoice,
  sendMessage,
  sendStop,
  sendSetHandoff,
  sendDeleteSession,
} from '../dashboard-rpc/control.js'

// The steering stories (README.md): everything the user does TO a live session — answer its
// question, chat with it, change its handoff, stop it — flows browser -> RPC -> control.jsonl ->
// the run process, and the observable answer comes back through the run's own event log.

test('answer a parked session’s question from the questions hub (#304/#1455)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const runId = await withFakeAwait('choices', () => world.startRun(project, 'Wire up auth'))
    const tail = await world.tailRun(project, runId)

    // The run parks: the full gate (title, options, recommendation) reaches the feed, and the
    // cross-project questions hub lists it against this session.
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    assert.equal(gate.kind, 'choice')
    if (gate.kind !== 'choice') return
    assert.ok(gate.options.length >= 2, 'the gate offers options')
    assert.ok(gate.recommended, 'the gate names a recommended option')
    const question = await waitFor(
      async () => (await rpc(onOpenQuestions)()).find(q => q.runId === runId),
      'the questions hub to list the parked run',
    )
    assert.equal(question.projectId, project.id)
    assert.equal(question.choice.id, gate.id)
    assert.deepEqual(question.choice.options.map(o => o.id), gate.options.map(o => o.id))

    // The user picks the recommended option. The run records who answered and carries on to done.
    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', runId)
    const resolved = await waitFor(() => tail.events.find(e => e.kind === 'choice-resolved'), 'the resolution event')
    assert.equal(resolved.kind === 'choice-resolved' && resolved.picked, gate.recommended)
    assert.equal(resolved.kind === 'choice-resolved' && resolved.by, 'user')
    await world.waitRun(project, runId, 'done')

    // Answered means gone from the hub.
    assert.equal((await rpc(onOpenQuestions)()).some(q => q.runId === runId), false)
  } finally {
    await world.close()
  }
})

test('chat with a live session: a message becomes the next agent turn (#714)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const runId = await withFakeAwait('choices', () => world.startRun(project, 'Build the dashboard page'))
    const tail = await world.tailRun(project, runId)
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    if (gate.kind !== 'choice') return

    // Said while the session is parked, so the queue provably holds it until the gate resolves.
    await rpc(sendMessage)(project.id, 'Also add a logout button', runId)
    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', runId)

    // The queued message is drained as its own turn: its text shows up as a driver prompt on the
    // feed the transcript renders.
    await waitFor(
      () =>
        tail.events.find(
          e => e.kind === 'driver' && e.event.type === 'start' && e.event.prompt.includes('Also add a logout button'),
        ),
      'the chat message to become an agent turn',
    )
    await world.waitRun(project, runId, 'done')
    await world.waitRetired(project, runId)

    // What was said survives the session (#1179): teardown archives the run's event log into the
    // project checkout, where the daemon's committer picks it up, so a clone carries the exchange
    // and not just the fact a run happened. The event log *is* that record (B3) — a second, prose
    // re-narration used to be committed beside it, which is what the Discord mirror then polled and
    // diffed instead of reading this.
    const archived = await archivedRunPaths(project.cwd, runId)
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
    const runId = await withFakeAwait('choices', () => world.startRun(project, 'Refactor the config layer'))
    const tail = await world.tailRun(project, runId)
    const gate = await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')
    if (gate.kind !== 'choice') return

    // The box starts armed (the PR rung is the default), and unticking it mid-run re-announces the
    // armed state — the event is what folds onto the meta a tab opened later reads back.
    await rpc(sendSetHandoff)(project.id, runId, 'local')
    await waitFor(
      () => tail.events.find(e => e.kind === 'handoff-armed' && !e.push && !e.pr),
      'the disarmed announcement',
    )
    const meta = await waitFor(async () => {
      const run = (await rpc(onRuns)(project.id)).find(r => r.id === runId)
      return run?.handoff && !run.handoff.push && !run.handoff.pr ? run : undefined
    }, 'the disarmed state to reach the run meta')
    assert.equal(meta.handoff?.push, false)
    assert.equal(meta.handoff?.pr, false)

    await rpc(sendChoice)(project.id, gate.id, gate.recommended!, 'user', runId)
    await world.waitRun(project, runId, 'done')
  } finally {
    await world.close()
  }
})

test('stop a session; its checkout is reclaimed once the work is on the remote, then deleted (#737/#1032/E5)', async () => {
  const world = await makeWorld()
  const rpc = world.rpc
  try {
    const project = await world.addProject()
    const runId = await withFakeAwait('choices', () => world.startRun(project, 'Long experiment'))
    const tail = await world.tailRun(project, runId)
    await waitFor(() => tail.events.find(e => e.kind === 'choice'), 'the parked gate')

    // Stop while parked: the run ends `stopped`, not failed — the user interrupted it.
    await rpc(sendStop)(project.id, runId)
    const end = await waitFor(() => tail.events.find(e => e.kind === 'end'), 'the end event')
    assert.equal(end.kind === 'end' && end.stopped, true)
    tail.stop()
    await world.waitRun(project, runId, 'stopped')

    // One rule (E5): the checkout goes once its work is on the remote, whatever the session did.
    // A stopped run used to keep it "for inspection", and nothing ever took those back — so a
    // machine accumulated one full checkout per stopped session until a human noticed. What was
    // stopped is not lost: the branch is on the remote, and `git worktree add` brings it back.
    await world.waitRetired(project, runId)
    assert.deepEqual(await rpc(onRetainedWorktrees)(project.id), [])
    assert.equal((await rpc(onRunWorktree)(project.id, runId))?.own, false, 'no checkout of its own is left')
    assert.ok((await rpc(onRuns)(project.id)).some(r => r.id === runId && r.status === 'stopped'), 'the session row survives')

    // Delete is the destructive sibling: the row itself disappears from the dashboard.
    const deleted = await rpc(sendDeleteSession)(project.id, runId)
    assert.equal(deleted.ok, true, `delete failed: ${'error' in deleted ? deleted.error : ''}`)
    assert.equal((await rpc(onRuns)(project.id)).some(r => r.id === runId), false)
  } finally {
    await world.close()
  }
})
