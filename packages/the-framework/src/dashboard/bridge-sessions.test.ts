import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { RunMeta } from '../store/index.js'
import { bridgeSessionsFrom, BRIDGE_SESSION_LIMIT } from './bridge-sessions.js'

const NOW = new Date('2026-07-26T20:00:00.000Z')

function run(over: Partial<RunMeta>): RunMeta {
  return {
    id: 'r',
    startedAt: '2026-07-26T19:00:00.000Z',
    status: 'done',
    intent: 'x',
    ...over,
  } as RunMeta
}

test('only web runs that carry a cloud session are offered (#1237)', () => {
  const got = bridgeSessionsFrom(
    [
      run({ id: 'a', target: 'web', sessionId: 'session_A' }),
      run({ id: 'b', target: 'local', sessionId: 'session_B' }),
      run({ id: 'c', target: 'actions', sessionId: 'session_C' }),
      // A web run whose hand-off never landed has nothing to open.
      run({ id: 'd', target: 'web' }),
    ],
    NOW,
  )
  assert.deepEqual(got, [{ id: 'session_A', url: 'https://claude.ai/code/session_A' }])
})

test('status is not the filter, because every web run reads done (#1231)', () => {
  // #1231 ends a web run at the hand-off, so `done` says nothing about whether its session is
  // parked. Filtering on status would offer nothing at all.
  const got = bridgeSessionsFrom([run({ target: 'web', sessionId: 'session_A', status: 'done' })], NOW)
  assert.equal(got.length, 1)
})

test('anything older than the window is dropped (#1237)', () => {
  const got = bridgeSessionsFrom(
    [
      run({ id: 'old', target: 'web', sessionId: 'session_OLD', startedAt: '2026-07-25T00:00:00.000Z' }),
      run({ id: 'new', target: 'web', sessionId: 'session_NEW', startedAt: '2026-07-26T19:30:00.000Z' }),
    ],
    NOW,
  )
  assert.deepEqual(got.map(s => s.id), ['session_NEW'])
})

test('newest first, and never more tabs than the cap (#1237)', () => {
  const runs = Array.from({ length: 8 }, (_, i) =>
    run({ id: `r${i}`, target: 'web', sessionId: `session_${i}`, startedAt: `2026-07-26T19:${String(10 + i).padStart(2, '0')}:00.000Z` }),
  )
  const got = bridgeSessionsFrom(runs, NOW)
  assert.equal(got.length, BRIDGE_SESSION_LIMIT)
  // A browser that quietly accumulates tabs is worse than a bridge that misses an old run.
  assert.deepEqual(got.map(s => s.id), ['session_7', 'session_6', 'session_5'])
})

test('the same session listed by two runs is offered once (#1237)', () => {
  const got = bridgeSessionsFrom(
    [
      run({ id: 'a', target: 'web', sessionId: 'session_SAME', startedAt: '2026-07-26T19:30:00.000Z' }),
      run({ id: 'b', target: 'web', sessionId: 'session_SAME', startedAt: '2026-07-26T19:10:00.000Z' }),
    ],
    NOW,
  )
  assert.equal(got.length, 1)
})

test('an unparseable start time is skipped rather than treated as now (#1237)', () => {
  assert.deepEqual(bridgeSessionsFrom([run({ target: 'web', sessionId: 'session_X', startedAt: 'not a date' })], NOW), [])
})
