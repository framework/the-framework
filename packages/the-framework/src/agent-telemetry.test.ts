import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createDriverEventHandler, emitSessionStart } from './agent-telemetry.js'
import type { Driver } from './driver/index.js'
import type { FrameworkEvent } from './events.js'

// #1322: the resume button needed a `session-update`, which only fired at `result` — a turn
// stopped mid-flight took the session id (the agent's `claude --resume` handle) down with it.
// The driver's turn-start announcement now lands the update before anything can lose it.

function handler(events: FrameworkEvent[], sessionLink?: string) {
  return createDriverEventHandler({
    emit: e => events.push(e),
    ...(sessionLink ? { sessionLink } : {}),
  })
}

test('the opening session event records the model the driver was started with (#1438)', () => {
  const events: FrameworkEvent[] = []
  const driver = { id: 'claude' } as unknown as Driver
  emitSessionStart({ emit: e => events.push(e), driver, cwd: '/w', model: 'fable' })
  assert.deepEqual(events, [{ kind: 'session', driver: 'claude', workspace: '/w', fake: false, model: 'fable' }])
  // No model configured -> none recorded: the agent's own default is not knowable here.
  const bare: FrameworkEvent[] = []
  emitSessionStart({ emit: e => bare.push(e), driver, cwd: '/w' })
  assert.deepEqual(bare, [{ kind: 'session', driver: 'claude', workspace: '/w', fake: false }])
})

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
