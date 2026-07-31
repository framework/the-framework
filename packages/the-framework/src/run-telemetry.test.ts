import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createDriverEventHandler } from './run-telemetry.js'
import type { FrameworkEvent } from './events.js'

// #1322: the resume button needed a `session-update`, which only fired at `result` — a turn
// stopped mid-flight took the session id (the run's `claude --resume` handle) down with it.
// The driver's turn-start announcement now lands the update before anything can lose it.

function handler(events: FrameworkEvent[], sessionLink?: string) {
  return createDriverEventHandler({
    emit: e => events.push(e),
    ...(sessionLink ? { sessionLink } : {}),
    budgetController: new AbortController(),
    consumptionController: new AbortController(),
  })
}

test('a session announcement emits session-update at turn start and is consumed, not forwarded (#1322)', () => {
  const events: FrameworkEvent[] = []
  handler(events, 'https://example.test/{sessionId}').onDriverEvent({ type: 'session', sessionId: 's1' })
  assert.deepEqual(events, [{ kind: 'session-update', sessionId: 's1', sessionLink: 'https://example.test/s1' }])
})

test('the result repeating the announced id does not emit a second session-update (#1322)', () => {
  const events: FrameworkEvent[] = []
  const h = handler(events)
  h.onDriverEvent({ type: 'session', sessionId: 's1' })
  h.onDriverEvent({ type: 'result', text: 'done', sessionId: 's1' })
  assert.equal(events.filter(e => e.kind === 'session-update').length, 1)
})

test('a result with a fresh id still emits, the pre-#1322 path unchanged', () => {
  const events: FrameworkEvent[] = []
  handler(events).onDriverEvent({ type: 'result', text: 'done', sessionId: 's2' })
  assert.deepEqual(
    events.filter(e => e.kind === 'session-update'),
    [{ kind: 'session-update', sessionId: 's2' }],
  )
})
