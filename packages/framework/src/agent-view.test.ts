import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { sessionInfo, agentProgress, agentErrors } from './agent-view.js'
import type { FrameworkEvent } from './events.js'

test('agentProgress starts building with no name and flips to ready on setReadyForMerge (#326)', () => {
  assert.deepEqual(agentProgress([]), { readyForMerge: false })
  // The birth branch is not a name (#1725): the agent is unnamed until it renames its branch.
  assert.deepEqual(agentProgress([{ kind: 'branch', branch: 'agent-r1' }]), { readyForMerge: false })
  const building: FrameworkEvent[] = [{ kind: 'branch', branch: 'agent-add-comments', sessionName: 'add-comments' }]
  assert.deepEqual(agentProgress(building), { sessionName: 'add-comments', readyForMerge: false })
  const ready: FrameworkEvent[] = [...building, { kind: 'ready-for-merge' }]
  assert.deepEqual(agentProgress(ready), { sessionName: 'add-comments', readyForMerge: true })
})

test('agentProgress reads the session name off the latest observed branch (#326/#1725)', () => {
  // The name rides the event: only the journal that wrote it knows which branch the checkout was
  // created on, so the projection never derives it from the branch itself (#1736).
  const events: FrameworkEvent[] = [
    { kind: 'branch', branch: 'agent-r1' },
    { kind: 'branch', branch: 'agent-first-guess', sessionName: 'first-guess' },
    { kind: 'branch', branch: 'agent-better-name-2', sessionName: 'better-name-2' },
  ]
  assert.equal(agentProgress(events).sessionName, 'better-name-2')
  // A branch The Framework did not mint carries no session name.
  assert.equal(agentProgress([...events, { kind: 'branch', branch: 'feat/mine' }]).sessionName, undefined)
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

test('agentErrors folds the errors the agent reported, oldest first (#1500)', () => {
  assert.deepEqual(agentErrors([]), [])
  const events: FrameworkEvent[] = [
    { kind: 'error', headline: 'gh is not logged in', detail: 'ran `gh auth status`' },
    { kind: 'branch', branch: 'agent-update-tickets' },
    { kind: 'error', headline: 'tickets/meta.json has no lastImportedAt' },
  ]
  assert.deepEqual(agentErrors(events), [
    { headline: 'gh is not logged in', detail: 'ran `gh auth status`' },
    { headline: 'tickets/meta.json has no lastImportedAt' },
  ])
})
