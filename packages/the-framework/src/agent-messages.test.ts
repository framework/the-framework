import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { AgentMessageQueue } from './agent-messages.js'

test('AgentMessageQueue drains already-queued messages in order (between turns)', async () => {
  const q = new AgentMessageQueue()
  q.push('one')
  q.push('two')
  assert.deepEqual(await q.next(), { text: 'one' })
  assert.deepEqual(await q.next(), { text: 'two' })
})

test('AgentMessageQueue hands a message to a parked waiter (stay-open)', async () => {
  const q = new AgentMessageQueue()
  const pending = q.next() // parks: nothing queued yet
  q.push('later')
  assert.deepEqual(await pending, { text: 'later' })
})

test('AgentMessageQueue close() wakes a parked waiter with undefined', async () => {
  const q = new AgentMessageQueue()
  const pending = q.next()
  q.close()
  assert.equal(await pending, undefined)
})

test('AgentMessageQueue next() resolves undefined once closed', async () => {
  const q = new AgentMessageQueue()
  q.close()
  assert.equal(await q.next(), undefined)
})

test('AgentMessageQueue push() is a no-op after close()', async () => {
  const q = new AgentMessageQueue()
  q.close()
  q.push('ignored')
  assert.equal(await q.next(), undefined)
})

test('AgentMessageQueue next() unblocks on abort (Stop / budget cap)', async () => {
  const q = new AgentMessageQueue()
  const ac = new AbortController()
  const pending = q.next(ac.signal)
  ac.abort()
  assert.equal(await pending, undefined)
})

test('AgentMessageQueue next() returns a queued message even if the signal is aborted', async () => {
  const q = new AgentMessageQueue()
  const ac = new AbortController()
  ac.abort()
  q.push('queued')
  // A message already in hand wins over the aborted signal: it is not lost.
  assert.deepEqual(await q.next(ac.signal), { text: 'queued' })
})

test('AgentMessageQueue takeQueued() drains without waiting — the end-of-run check (#1390)', () => {
  const q = new AgentMessageQueue()
  q.push('follow-up')
  assert.deepEqual(q.takeQueued(), { text: 'follow-up' })
  // Idle queue: undefined, immediately — this is what lets the session end itself.
  assert.equal(q.takeQueued(), undefined)
})

test('AgentMessageQueue takeQueued() is undefined once closed, pending or not (#1390)', () => {
  const q = new AgentMessageQueue()
  q.push('stale')
  q.close()
  // A closed queue is an aborted run: a stale message must not start a new turn.
  assert.equal(q.takeQueued(), undefined)
})
