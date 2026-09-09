import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { FrameworkEvent } from '../events.js'
import type { AgentMeta } from './agent-store.js'
import { diaryOf, eventsOf, fromRunCard, toRunCard } from './run-record.js'

test('the meta round-trips through the skill\'s card: eleven fields on top, the rest under caller (#1769)', () => {
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
    handoff: { push: true, pr: true, merge: true },
    branch: 'agent-r1',
    driver: 'claude-code',
    workspace: '/w',
    model: 'opus',
    readyForMerge: true,
    mergeOutcome: 'auto-armed',
    pr: { number: 1765, url: 'https://x/pull/1765' },
    ticket: 'tickets/2026-09-01_a.md',
    cost: 0.62,
  }
  const card = toRunCard(meta)
  assert.deepEqual(Object.keys(card), ['id', 'startedAt', 'status', 'endedAt', 'intent', 'driver', 'model', 'branch', 'pr', 'ticket', 'cost', 'caller'])
  assert.deepEqual(card.caller, { updatedAt: meta.updatedAt, pid: 923, host: 'laptop', kind: 'prompt', handoff: meta.handoff, workspace: '/w', readyForMerge: true, mergeOutcome: 'auto-armed' })
  assert.deepEqual(fromRunCard(card), meta)
  // The framework's last-updated time is its own, so even a bare meta carries a caller; a card
  // with no caller at all (another writer's) unfolds with an updatedAt from its end or its start.
  const bare = toRunCard({ status: 'running', id: 'r2', startedAt: 't', updatedAt: 't' })
  assert.deepEqual(bare, { id: 'r2', startedAt: 't', status: 'running', caller: { updatedAt: 't' } })
  assert.deepEqual(fromRunCard({ id: 'r2', startedAt: 't', status: 'done', endedAt: 'e' }), { id: 'r2', startedAt: 't', status: 'done', endedAt: 'e', updatedAt: 'e' })
})

test('the events round-trip through the diary: four kinds mapped, every other line as it is (#1769)', () => {
  const events: FrameworkEvent[] = [
    { kind: 'session', driver: 'claude-code', workspace: '/w', fake: false, model: 'opus' },
    { kind: 'driver', event: { type: 'start', prompt: 'go' } },
    { kind: 'driver', event: { type: 'text', text: 'Reading.' } },
    { kind: 'driver', event: { type: 'action', label: 'Bash' } },
    { kind: 'driver', event: { type: 'result', text: 'Done.', sessionId: 's1', usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 } } },
    { kind: 'usage', costUsd: 0.5, inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0, turns: 1 },
    { kind: 'usage', inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0, turns: 1 },
    { kind: 'end', ok: true },
    { kind: 'end', ok: false, stopped: true, detail: 'its process died' },
    { kind: 'end', ok: false, detail: 'API 500' },
  ]
  const diary = diaryOf(events)
  assert.deepEqual(diary.map(line => line.kind), ['session', 'driver', 'said', 'driver', 'result', 'cost', 'cost', 'ended', 'ended', 'ended'])
  assert.deepEqual(diary[2], { kind: 'said', text: 'Reading.' })
  assert.deepEqual(diary[4], { kind: 'result', text: 'Done.', sessionId: 's1', usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 } })
  assert.deepEqual(diary[5], { kind: 'cost', usd: 0.5, inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0, turns: 1 })
  assert.deepEqual(diary[7], { kind: 'ended', status: 'done' })
  assert.deepEqual(diary[8], { kind: 'ended', status: 'stopped', detail: 'its process died' })
  assert.deepEqual(diary[9], { kind: 'ended', status: 'failed', detail: 'API 500' })
  assert.deepEqual(eventsOf(diary), events)
})
