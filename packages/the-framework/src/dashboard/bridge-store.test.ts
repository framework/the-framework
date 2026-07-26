import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { BridgeQuestions } from './bridge-store.js'
import type { BridgeQuestion } from './bridge-endpoints.js'

const SESSION = 'session_01Test'

const question = (title = 'Pick one'): BridgeQuestion => ({
  sessionId: SESSION,
  title,
  options: [{ label: 'Alpha' }, { label: 'Beta' }],
  recommended: 'Beta',
  receivedAt: '2026-07-26T18:00:00.000Z',
})

test('an answer can only be a label the parked question offered (#1237)', () => {
  const store = new BridgeQuestions()
  assert.equal(store.queueAnswer(SESSION, 'Alpha'), 'that session has no parked question')
  store.record(question())
  assert.equal(store.queueAnswer(SESSION, 'rm -rf /'), 'that label is not one of the question options')
  const queued = store.queueAnswer(SESSION, 'Alpha')
  assert.ok(typeof queued === 'object')
  assert.equal(queued.state, 'queued')
  assert.equal(store.pendingAnswer(SESSION)?.label, 'Alpha')
})

test('a delivered answer resolves the question, and its re-report is ignored (#1237)', () => {
  const store = new BridgeQuestions()
  store.record(question())
  const queued = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof queued === 'object')
  store.resolveAnswer(SESSION, queued.id, true)
  assert.equal(store.get(SESSION), undefined)
  assert.equal(store.answer(SESSION)?.state, 'sent')
  assert.equal(store.pendingAnswer(SESSION), undefined)
  // The answered block stays in the page's DOM and the worker forgets what it sent on restart,
  // so the same question WILL be reported again. It must not resurface as parked.
  store.record(question())
  assert.equal(store.get(SESSION), undefined)
  // A genuinely new question does surface, and clears the resolved answer with it.
  store.record(question('Something new'))
  assert.equal(store.get(SESSION)?.title, 'Something new')
  assert.equal(store.answer(SESSION), undefined)
})

test('a failed delivery keeps the question so the user can retry (#1237)', () => {
  const store = new BridgeQuestions()
  store.record(question())
  const queued = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof queued === 'object')
  store.resolveAnswer(SESSION, queued.id, false, 'no composer on the page')
  assert.equal(store.get(SESSION)?.title, 'Pick one')
  assert.equal(store.answer(SESSION)?.state, 'failed')
  assert.equal(store.answer(SESSION)?.note, 'no composer on the page')
  // Retrying replaces the failed attempt.
  const retried = store.queueAnswer(SESSION, 'Alpha')
  assert.ok(typeof retried === 'object')
  assert.equal(store.pendingAnswer(SESSION)?.label, 'Alpha')
})

test('a queued answer can be withdrawn, a resolved one cannot (#1237)', () => {
  const store = new BridgeQuestions()
  store.record(question())
  const queued = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof queued === 'object')
  assert.equal(store.cancelAnswer(SESSION), true)
  assert.equal(store.answer(SESSION), undefined)
  const again = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof again === 'object')
  store.resolveAnswer(SESSION, again.id, true)
  assert.equal(store.cancelAnswer(SESSION), false)
  assert.equal(store.answer(SESSION)?.state, 'sent')
})

test('a stale ack cannot resolve a newer answer (#1237)', () => {
  const store = new BridgeQuestions()
  store.record(question())
  const first = store.queueAnswer(SESSION, 'Alpha')
  assert.ok(typeof first === 'object')
  const second = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof second === 'object')
  store.resolveAnswer(SESSION, first.id, true)
  assert.equal(store.answer(SESSION)?.state, 'queued')
  assert.equal(store.get(SESSION)?.title, 'Pick one')
})

test('an undelivered pick dies with the question it answered (#1237)', () => {
  const store = new BridgeQuestions()
  store.record(question())
  const queued = store.queueAnswer(SESSION, 'Beta')
  assert.ok(typeof queued === 'object')
  // The session moved on before the extension collected the pick: typing the old answer into
  // the new question would be answering a question nobody asked.
  store.record(question('Something new'))
  assert.equal(store.pendingAnswer(SESSION), undefined)
})
