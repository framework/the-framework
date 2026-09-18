import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { FrameworkEvent } from '../events.js'
import type { AgentMeta } from './agent-store.js'
import { eventsOf, fromDiaryLine, fromRunCard } from './run-record.js'

test('a card unfolds into the meta: the skill\'s fields on top, whatever sits under caller beside them (#1769)', () => {
  const meta: AgentMeta = {
    status: 'done',
    id: 'r1',
    startedAt: '2026-09-08T18:14:30.651Z',
    updatedAt: '2026-09-08T18:15:40.433Z',
    endedAt: '2026-09-08T18:15:40.433Z',
    pid: 923,
    host: 'laptop',
    intent: 'fix it',
    kind: 'prompt',
    branch: 'agent-r1',
    driver: 'claude-code',
    workspace: '/w',
    model: 'opus',
    pr: { number: 1765, url: 'https://x/pull/1765' },
    cost: 0.62,
  }
  const { updatedAt, pid, host, kind, workspace, ...own } = meta
  assert.deepEqual(fromRunCard({ ...own, caller: { updatedAt, pid, host, kind, workspace } }), meta)
  // A card with no caller at all unfolds with an updatedAt from its end, or from its start.
  assert.deepEqual(fromRunCard({ id: 'r2', startedAt: 't', status: 'done', endedAt: 'e' }), { id: 'r2', startedAt: 't', status: 'done', endedAt: 'e', updatedAt: 'e' })
  assert.deepEqual(fromRunCard({ id: 'r3', startedAt: 't', status: 'running' }), { id: 'r3', startedAt: 't', status: 'running', updatedAt: 't' })
})

test('a diary reads as events: the skill\'s four kinds mapped, every other line as it is (#1769)', () => {
  const usage = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 }
  assert.deepEqual(
    eventsOf([
      { kind: 'session', driver: 'claude-code', workspace: '/w', fake: false, model: 'opus' },
      { kind: 'said', text: 'Reading.' },
      { kind: 'result', text: 'Done.', sessionId: 's1', usage },
      { kind: 'cost', usd: 0.5, ...usage, turns: 1 },
      { kind: 'cost', ...usage, turns: 1 },
      { kind: 'ended', status: 'done' },
      { kind: 'ended', status: 'stopped', detail: 'its process died' },
      { kind: 'ended', status: 'failed', detail: 'API 500' },
    ]),
    [
      { kind: 'session', driver: 'claude-code', workspace: '/w', fake: false, model: 'opus' },
      { kind: 'driver', event: { type: 'text', text: 'Reading.' } },
      { kind: 'driver', event: { type: 'result', text: 'Done.', sessionId: 's1', usage } },
      { kind: 'usage', costUsd: 0.5, ...usage, turns: 1 },
      { kind: 'usage', ...usage, turns: 1 },
      { kind: 'end', ok: true },
      { kind: 'end', ok: false, stopped: true, detail: 'its process died' },
      { kind: 'end', ok: false, detail: 'API 500' },
    ] satisfies FrameworkEvent[],
  )
})

test('a diary agent-driver\'s own log wrote reads back as the framework\'s events: driver lines, the session id, the question as a gate, a waiting end (#1774)', () => {
  assert.deepEqual(fromDiaryLine({ kind: 'start', prompt: '/work-queue' }), { kind: 'driver', event: { type: 'start', prompt: '/work-queue' } })
  assert.deepEqual(fromDiaryLine({ kind: 'action', label: 'Bash' }), { kind: 'driver', event: { type: 'action', label: 'Bash' } })
  assert.deepEqual(fromDiaryLine({ kind: 'notice', message: 'retried' }), { kind: 'driver', event: { type: 'notice', message: 'retried' } })
  assert.deepEqual(fromDiaryLine({ kind: 'error', message: 'claude exited with code 1' }), { kind: 'driver', event: { type: 'error', message: 'claude exited with code 1' } })
  // An `error` block of a run recorded before the daemon stopped running agents is the agent's own report, not a driver's.
  assert.deepEqual(fromDiaryLine({ kind: 'error', headline: 'gh is not logged in', detail: 'ran gh auth status' }), { kind: 'error', headline: 'gh is not logged in', detail: 'ran gh auth status' })
  assert.deepEqual(fromDiaryLine({ kind: 'session', sessionId: 's-1' }), { kind: 'session-update', sessionId: 's-1' })
  // The framework's own session event, written by its run child, still reads as itself.
  assert.deepEqual(fromDiaryLine({ kind: 'session', driver: 'claude-code', workspace: '/w', fake: false }), { kind: 'session', driver: 'claude-code', workspace: '/w', fake: false })
  assert.deepEqual(fromDiaryLine({ kind: 'question', title: 'Ship it?', options: [{ id: 'opt:0', label: 'Approve' }, { id: 'opt:1', label: 'Decline', stop: true }], recommended: 'opt:0' }), {
    kind: 'choice',
    id: 'await-choices',
    title: 'Ship it?',
    options: [{ id: 'opt:0', label: 'Approve' }, { id: 'opt:1', label: 'Decline', stop: true }],
    recommended: 'opt:0',
  })
  assert.deepEqual(fromDiaryLine({ kind: 'ended', status: 'waiting' }), { kind: 'end', ok: false, waiting: true })
  assert.deepEqual(fromDiaryLine({ kind: 'ended', status: 'stopped', detail: 'by hand' }), { kind: 'end', ok: false, stopped: true, detail: 'by hand' })
})
