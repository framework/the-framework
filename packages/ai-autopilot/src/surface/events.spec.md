`EventStream` — the replayable, multi-consumer event transport — plus the terminal surface (`formatEvent` / `terminalSink`).

## TLDR

- `EventStream<E = SupervisorEvent>`: `push` (also exposed as the `sink` getter, reading well at `onEvent:` call sites) appends and wakes waiters, ignored after close; `history(fromOffset)` replays buffered events (borrowing Flue Durable-Streams' `tail=N`); `close()` is idempotent and lets live iterators drain their backlog then finish.
- Each `[Symbol.asyncIterator]()` keeps its own cursor: replay full history → live events as pushed → done once closed and drained; late subscribers still see everything.
- Iterator `return()` cancels cleanly: removes its waiter from the stream and settles a pending `next()`, so a disconnected SSE consumer doesn't linger until the next push; a later push must not resurrect it.
- `formatEvent` renders each `SupervisorEvent` variant as one human-readable line (`▶ plan:`, `plan trimmed:`, `→ id`, `✓/✗ id`, `! budget exceeded:`, `▶ synthesize:`); `terminalSink(opts)` is an `onEvent` sink writing those lines (default `process.stdout` + newline).

## Decisions

- The element type is generic with `SupervisorEvent` as default, so bootstrap (and future surfaces) reuse the same transport with their own event types without touching supervisor call sites.

## Problems

- Waiter bookkeeping across multiple concurrent iterators: waking is done by splicing the shared `waiters` array on every push/close, and cancellation (`return()`) must remove exactly its own waiter — the leak this prevents was a disconnected consumer holding a pending `next()` until the stream ended.
