# Bug analysis: packages/framework/src/dashboard-rpc/stream-forward.ts

## Business logic (high-level)

The pump behind a relayed run's live feed (#426): forward an `AsyncIterable` to a `send` callback
until the source ends or the returned stop function runs. Per `stream-forward.SPEC.md`: a source
that ends on its own is announced via `onDone` (so an SSE response can close instead of idling on a
finished agent); stopping halts forwarding, releases the waiting follower, and is idempotent; an
absent source is a no-op. Sole production caller: `streamAgentEvents` (`events.ts`), which wires
`send` to an SSE frame writer and `onDone` to ending the response; the sources are `EventStream`
iterators (independent cursors, `return()` deregisters the waiter).

Concurrency/ordering walkthrough (against `EventStream`):

- Pump starts synchronously inside the IIFE, so the first `iterator.next()` is registered before
  `stop` can run; JS single-threading means `stop()` only interleaves at awaits.
- `stop()` mid-wait: `stopped = true`, `iterator.return()` resolves the pending `next()` as done
  and removes the waiter → loop exits → `if (!stopped)` is false → no `onDone`. Nothing delivered
  after stop; no leaked waiter. Correct.
- `stop()` between an event's `send` and the loop's update clause: impossible — no await between
  them. After `send`, the update's `iterator.next()` runs, then the condition re-checks `stopped`.
  If `stop()` ran while that `next()` was pending, the value it resolved with is dropped (not
  sent) — one event consumed from this pump's *own* cursor, invisible to other consumers.
  Harmless. Correct.
- Source exhausts (`next.done`): loop exits, `stopped` false → `onDone` fires exactly once.
  Correct.
- `next()` rejects: caught, then `onDone` (if not stopped) — "the stream closed" is a finished
  feed. Correct per spec.
- `send` throws (e.g. writing to a destroyed SSE response): the catch swallows it and `onDone`
  fires even though the source did not end — a spec-wording mismatch ("fires when the source runs
  out on its own"). Consequence-checked: the only `onDone` in production ends the same response
  the failed `send` was writing to, which is already dead, so the misfire is unobservable. Also
  the iterator is then abandoned without `return()`; for `EventStream` no waiter is registered at
  that moment (the throw happens between `next()` resolutions), so nothing leaks. Suspicious but
  proven benign for every current consumer — not reported. A future non-EventStream source
  (async generator) would merely be left suspended for GC.
- Double `stop()`: second call re-runs `return()`, which is idempotent. Correct.
- `iterable` undefined: returns a no-op stop. Correct.

## Functions (low-level)

- `forwardStream<T>(iterable, send, onDone?)` — as analyzed above. Inputs: possibly-undefined
  iterable, sync sink, optional done callback; output: idempotent stop. The `void` on the IIFE and
  on `iterator.return?.()` acknowledges the intentionally-unawaited promises; the IIFE cannot
  reject (whole body inside try/catch plus a sync tail). Verdict: correct (with the benign
  `send`-throw → `onDone` nuance noted).

## Bugs found

None found.
