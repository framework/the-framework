import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { sessionInfo } from './agent-view.js'
import type { FrameworkEvent } from './events.js'

test('sessionInfo merges the opening session with the latest session-update link (#431)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'session', driver: 'claude', workspace: '/repo', fake: false },
    { kind: 'session-update', sessionId: 'sess-1', sessionLink: 'https://claude.ai/code/sess-1' },
  ]
  const info = sessionInfo(events)
  assert.equal(info?.driver, 'claude')
  assert.equal(info?.sessionId, 'sess-1')
  assert.equal(info?.sessionLink, 'https://claude.ai/code/sess-1')
  assert.equal(sessionInfo([{ kind: 'end', ok: true }]), null)
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

