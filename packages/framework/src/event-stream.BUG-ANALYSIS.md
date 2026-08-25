# Bug analysis: packages/framework/src/event-stream.ts

## Business logic (high-level)

An in-memory, replayable, multi-consumer event stream: every event is buffered forever, and any
number of async iterators can each read the whole history and then continue live. Per
`event-stream.SPEC.md` its four promises are: nothing is missed by arriving late; replay from a
given position; ending is orderly (no event accepted after close, but each consumer still drains
what was buffered); and a consumer that goes away is forgotten immediately.

**How each promise is met.**

- *Late arrival* — each call to `[Symbol.asyncIterator]()` creates a fresh closure with its own
  `index = 0`, and `next()` reads straight out of the shared `buffer`. So a consumer attaching at
  event 500 replays 0-499 before waiting. Independent cursors are per-iterator locals, never shared.
- *Replay from a point* — `history(fromOffset)` returns `buffer.slice(fromOffset)`. (No caller in
  the package uses it today; the only live consumers are `dashboard/remote-run.ts` and
  `dashboard-rpc/stream-forward.ts`, which iterate. Dead surface is not a defect.) Worth noting
  `slice` treats a negative offset as "from the end", so a caller computing `length - n` with
  `n > length` gets the last `n` rather than an error — which happens to be exactly the tail-replay
  semantics the doc comment describes, so the accident is benign.
- *Orderly ending* — `push` returns early once `closed`, `close()` is idempotent (guarded by the
  same flag), and a waiting `next()` is woken by `close()` and then re-checks `index <
  buffer.length` **before** `stream.closed` (L73 before L74), so a consumer that was behind still
  drains its backlog before being told `done`. That ordering is the whole "drain, then finish"
  guarantee and it is correct.
- *Forgetting a departed consumer* — `return()` (invoked by `for await … break`/`throw`, and by
  the SSE teardown path) sets `done`, splices its waiter out of the shared array, and settles the
  pending `next()`. Without it, a disconnected consumer's closure would sit in `waiters` until the
  next push; with it, the array is trimmed immediately.

**Concurrency / ordering analysis.** `push` wakes waiters with `this.waiters.splice(0)`, i.e. it
takes the whole list and empties it in one go, so a waker that re-registers (L77-78) lands in a
*fresh* list rather than being re-visited inside the same loop — no infinite loop, no double
delivery. `wake()` only ever resolves an already-created promise, so no user code runs
synchronously inside `push`; re-entrancy is impossible. Two iterators woken by the same push each
advance their own index, so both see the event. An iterator woken with nothing left for it (its
event was consumed by a concurrent `next()` on the *same* iterator) re-arms instead of resolving a
false `done` — L75-78 handles precisely that.

**The one structural weakness, not a bug.** `pending` holds only the most recent waiter, so two
`next()` calls in flight on one iterator leave the earlier waiter unremovable by `return()`; it
lingers until the next `push` or `close`. `for await` never overlaps `next()` calls, and no caller
in this package drives the iterator by hand, so this is unreachable — and the buffer is retained
anyway (nothing is unbounded that was not already unbounded by design).

**Unbounded memory** is deliberate: the SPEC's first promise requires keeping every event for the
life of a run, and the stream's life is one agent run.

## Functions (low-level)

- **`push(event)`** (arrow property, so it can be detached as an `onEvent` sink) — appends and
  wakes every waiter. Ignores everything after `close()`, per the SPEC. Verdict: correct.
- **`get sink()`** — returns `this.push`; safe to detach because `push` is bound by being an arrow
  field. Verdict: correct.
- **`history(fromOffset = 0)`** — a defensive copy via `slice`, so a caller mutating the result
  cannot corrupt the buffer. Negative-offset behaviour analyzed above. Verdict: correct.
- **`get length()` / `get isClosed()`** — plain reads. Verdict: correct.
- **`close()`** — idempotent, wakes all waiters so they can drain-then-finish. Does not clear the
  buffer, which is required: a consumer attaching after close must still replay the history, and
  `next()`'s `index < buffer.length` check before the `closed` check gives it exactly that.
  Verdict: correct.
- **`[Symbol.asyncIterator]()`** — returns a self-iterable iterator with `index`/`done`/`pending`
  closure state. `next()`: finished → done; buffered → yield; closed → done; else park. The parked
  `wake` repeats the same three checks in the same order. `return()`: mark done, unregister, settle.
  A `next()` after `return()` short-circuits on `done`. There is no `throw()` method, so an
  exception inside `for await` falls back to `return()` — which is what the runtime does anyway.
  Verdict: correct.

## Bugs found

None found.
