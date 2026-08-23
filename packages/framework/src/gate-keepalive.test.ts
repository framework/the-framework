import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createGateKeepalive, nodeKeepaliveTimers, type KeepaliveTimer, type KeepaliveTimers } from './gate-keepalive.js'

/** A timer seam that only counts: what started, what stopped, whether one is live now. */
function spyTimers(): KeepaliveTimers & { started: number; stopped: number; live: () => number } {
  let started = 0
  let stopped = 0
  return {
    get started() {
      return started
    },
    get stopped() {
      return stopped
    },
    live: () => started - stopped,
    start: () => {
      started++
      return {}
    },
    stop: () => {
      stopped++
    },
  }
}

/** A promise plus its out-of-band resolvers, for driving a hold by hand. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (err: unknown) => void } {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('the first hold starts the timer, and settling it stops it', async () => {
  const timers = spyTimers()
  const keepalive = createGateKeepalive(timers)
  const wait = deferred<string>()

  const held = keepalive.hold(wait.promise)
  assert.equal(timers.live(), 1)
  assert.equal(keepalive.held(), 1)

  wait.resolve('pick')
  assert.equal(await held, 'pick')
  assert.equal(timers.live(), 0)
  assert.equal(keepalive.held(), 0)
})

test('overlapping holds share one timer; the last to settle releases it', async () => {
  const timers = spyTimers()
  const keepalive = createGateKeepalive(timers)
  const gate = deferred<string>()
  const chat = deferred<string>()

  const heldGate = keepalive.hold(gate.promise)
  const heldChat = keepalive.hold(chat.promise)
  assert.equal(timers.started, 1) // shared, not one per hold

  gate.resolve('proceed')
  await heldGate
  assert.equal(timers.live(), 1) // the chat wait is still parked

  chat.resolve('a message')
  await heldChat
  assert.equal(timers.live(), 0)
})

test('a rejected hold releases the timer and rethrows', async () => {
  const timers = spyTimers()
  const keepalive = createGateKeepalive(timers)
  const wait = deferred<never>()

  const held = keepalive.hold(wait.promise)
  wait.reject(new Error('watcher died'))
  await assert.rejects(held, /watcher died/)
  assert.equal(timers.live(), 0)
})

test('a hold after everything settled starts a fresh timer', async () => {
  const timers = spyTimers()
  const keepalive = createGateKeepalive(timers)

  await keepalive.hold(Promise.resolve('first gate'))
  assert.equal(timers.live(), 0)

  const wait = deferred<string>()
  const held = keepalive.hold(wait.promise)
  assert.equal(timers.started, 2)
  wait.resolve('second gate')
  await held
  assert.equal(timers.live(), 0)
})

test('the real timer is ref’d — holding it is what keeps the event loop alive', () => {
  const timer: KeepaliveTimer = nodeKeepaliveTimers.start()
  try {
    // hasRef() is the whole point (#1359): an unref’d interval would let Node exit 0
    // mid-await exactly as before, with the keepalive reduced to decoration.
    assert.equal(timer.hasRef?.(), true)
  } finally {
    nodeKeepaliveTimers.stop(timer)
  }
})
