# Bug analysis: packages/framework/src/dashboard-rpc/stream-forward.test.ts

## Business logic (high-level)

Pins the three behaviors `stream-forward.test.SPEC.md` names: replay-then-follow for a subscriber
joining mid-run, nothing delivered after stop, and the undefined-source no-op with idempotent stop.
All three run against the real `EventStream`, which is the production source, so the pinned
behavior is the deployed pairing rather than a mock's.

Determinism check (the risky part of async-iterator tests):

- Test 1: two events buffered before subscribing, `await tick()` (setImmediate) drains the
  microtask replay → `[1, 2]`; a live push then `tick` → `[1, 2, 3]`. Each assertion can fail if
  replay or follow breaks; `setImmediate` runs after promise jobs, so the flush is reliable.
  `stop()` at the end releases the pump's waiter — no cross-test leak.
- Test 2: push, tick, `stop()`, push again, tick, assert `[1]`. Verified against the source: at
  `stop()` the pump is parked in `iterator.next()`; `return()` removes the waiter, so the second
  push wakes nobody and cannot be sent. Deterministic, and it genuinely fails if `stop` stops
  cancelling the iterator.
- Test 3: undefined source with a `send` that `assert.fail`s; `stop()` twice. Proves the no-op and
  idempotence; the `send` tripwire would surface any spurious delivery synchronously.

What is *not* covered: `onDone` — both the fires-on-exhaustion path (close the stream, expect one
`onDone`) and the must-not-fire-after-stop path are untested, though `stream-forward.SPEC.md`
makes the finished-announcement a headline behavior. A regression that never called `onDone` (SSE
responses left open on finished relayed agents) or called it after `stop` would pass this suite.
Coverage gap, not a wrong assertion — noted, not reported as a bug (the test SPEC scopes itself to
the three covered behaviors).

## Functions (low-level)

- `tick()` — `setImmediate` wrapper; correct flush primitive for this pairing.
- Three `test()` blocks as above; no tautologies, each assertion falsifiable.

## Bugs found

None found.
