import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { sessionInfo, agentProgress, handoffState } from './agent-view.js'
import type { FrameworkEvent } from './events.js'

test('agentProgress starts building with no name and flips to ready on setReadyForMerge (#326)', () => {
  assert.deepEqual(agentProgress([]), { readyForMerge: false })
  const building: FrameworkEvent[] = [{ kind: 'session-name', name: 'add-comments' }]
  assert.deepEqual(agentProgress(building), { sessionName: 'add-comments', readyForMerge: false })
  const ready: FrameworkEvent[] = [...building, { kind: 'ready-for-merge' }]
  assert.deepEqual(agentProgress(ready), { sessionName: 'add-comments', readyForMerge: true })
})

test('agentProgress takes the latest session name when the agent renames it (#326)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'session-name', name: 'first-guess' },
    { kind: 'session-name', name: 'better-name' },
  ]
  assert.equal(agentProgress(events).sessionName, 'better-name')
})

test('sessionInfo merges the opening session with the latest session-update link (#431)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'session', driver: 'claude', workspace: '/repo', fake: false },
    { kind: 'session-update', sessionId: 'sess-1', sessionLink: 'https://claude.ai/code/sess-1' },
  ]
  const info = sessionInfo(events)
  assert.equal(info?.driver, 'claude')
  assert.equal(info?.sessionId, 'sess-1')
  assert.equal(info?.sessionLink, 'https://claude.ai/code/sess-1')
  assert.equal(sessionInfo([{ kind: 'log', message: 'x' }]), null)
})

test('sessionInfo keeps the workspace the run used, so a removed worktree is still nameable (#1195)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'session', driver: 'claude', workspace: '/repo/.the-framework/worktrees/run-1', fake: false },
    { kind: 'session-update', sessionId: 'sess-1' },
  ]
  // The later session-update must not drop it: the id arrives after the workspace, and it is the
  // pair together that reopens the session in a terminal.
  assert.equal(sessionInfo(events)?.workspace, '/repo/.the-framework/worktrees/run-1')
  assert.equal(sessionInfo(events)?.sessionId, 'sess-1')
})

test('sessionInfo carries the model per leg — the latest session event wins, an unrecorded one clears it (#1438)', () => {
  const one: FrameworkEvent[] = [{ kind: 'session', driver: 'claude', workspace: '/w', fake: false, model: 'fable' }]
  assert.equal(sessionInfo(one)?.model, 'fable')
  // A continuation leg re-emits session and may run a different model: the reader folds, not pins.
  const two: FrameworkEvent[] = [...one, { kind: 'session', driver: 'claude', workspace: '/w', fake: false, model: 'sonnet' }]
  assert.equal(sessionInfo(two)?.model, 'sonnet')
  const bare: FrameworkEvent[] = [...two, { kind: 'session', driver: 'claude', workspace: '/w', fake: false }]
  assert.equal(sessionInfo(bare)?.model, undefined)
})

test('a run with no handoff events reads as armed, matching what it will do (#1102)', () => {
  // An older agent emits no `handoff-armed`. Reading that as disarmed would show two unticked boxes
  // for a session that is in fact going to push and open a PR. Merge is the opposite (#1382): it
  // is opt-in, so silence must read as off.
  assert.deepEqual(handoffState([]), { push: true, pr: true, merge: false })
})

test('handoffState seeds from the run record when the stream missed the opening event (#1376)', () => {
  // The agent writes `handoff-armed` as its very first event, before the live channel attaches, so
  // a live tab folds a stream without it. The record's mirror is the truth then: a push-only agent
  // must not read as "Open PR".
  assert.deepEqual(handoffState([], { push: true, pr: false }), { push: true, pr: false, merge: false })
  // A `handoff-armed` in the stream is newer than any record snapshot: it wins over the seed.
  const rearmed: FrameworkEvent[] = [{ kind: 'handoff-armed', push: true, pr: true }]
  assert.deepEqual(handoffState(rearmed, { push: true, pr: false }), { push: true, pr: true, merge: false })
})

test('handoffState takes the latest arming, so unticking a box sticks (#1102)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'handoff-armed', push: true, pr: true },
    { kind: 'handoff-armed', push: true, pr: false },
  ]
  assert.deepEqual(handoffState(events), { push: true, pr: false, merge: false })
})

test('handoffState carries the merge arming, and an event without it keeps the seed (#1382)', () => {
  // A merge-armed agent must never read as "draft PR": that lie is the whole of #1382.
  const armed: FrameworkEvent[] = [{ kind: 'handoff-armed', push: true, pr: true, merge: true }]
  assert.deepEqual(handoffState(armed), { push: true, pr: true, merge: true })
  // Seeded from the record mirror when the stream missed the opening event, like push/pr (#1376).
  assert.deepEqual(handoffState([], { push: true, pr: true, merge: true }), { push: true, pr: true, merge: true })
  // A pre-#1382 event carries no merge field: it must not flip a seeded arming off.
  const old: FrameworkEvent[] = [{ kind: 'handoff-armed', push: true, pr: true }]
  assert.deepEqual(handoffState(old, { push: true, pr: true, merge: true }), { push: true, pr: true, merge: true })
})

test('handoffState carries the outcome once the handoff has run (#1102)', () => {
  const done: FrameworkEvent[] = [
    { kind: 'handoff-armed', push: true, pr: true },
    { kind: 'handoff', outcome: 'done', pushed: true, url: 'https://github.com/o/r/pull/3' },
  ]
  assert.deepEqual(handoffState(done).result, { outcome: 'done', url: 'https://github.com/o/r/pull/3' })

  // A failure has to survive into the projection: it is what the bar shows beside the retry button.
  const failed: FrameworkEvent[] = [{ kind: 'handoff', outcome: 'failed', step: 'push', error: 'fatal: no write access' }]
  assert.deepEqual(handoffState(failed).result, { outcome: 'failed', error: 'fatal: no write access' })

  const skipped: FrameworkEvent[] = [{ kind: 'handoff', outcome: 'skipped', reason: 'no-remote' }]
  assert.deepEqual(handoffState(skipped).result, { outcome: 'skipped', reason: 'no-remote' })
})
