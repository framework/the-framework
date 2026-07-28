`QueuedPromptBuilder` (created by `agent.queue(prompt)`) — fluent builder that dispatches an agent prompt onto a host-registered queue, optionally live-broadcasting stream progress to a channel; plus `configureAiQueue`, the adapter registration point.

## TLDR

- Knobs: `onQueue(name)` (default `'default'`), `delay(ms)`, `then(fn)`/`catch(fn)`, `broadcast(channel, {eventPrefix})`.
- `send()` loads the registered `QueueDispatch` and enqueues a closure: broadcast set ⇒ `agent.stream()` with every chunk pushed as `chunk` and the final response as `done`; otherwise plain `agent.prompt()`. Errors emit a best-effort `error` event (broadcast mode), then go to `catch(fn)` or rethrow.
- `configureAiQueue({dispatch, broadcast?})` swaps the module-level loaders and returns a restore fn; default dispatch loader throws "needs a queue adapter"; default broadcast loader resolves `null`.
- `_setQueueJobLoadersForTests` is an explicit test-only seam (deliberately `_`-prefixed) for `queue-job.test.ts`.

## Facts

- Events on the channel: `${prefix}chunk` (per StreamChunk), `${prefix}done` (AgentResponse), `${prefix}error` (`{message}`); prefix defaults to `''`.
- Broadcast requires the worker to reach the broadcast adapter; cross-process worker↔server setups need their own pub/sub bridge (out of v1 scope).
- `broadcast()` errors are thrown inside the queued job (adapter/`stream()` missing), not at `send()` time.

## Flows

- queue: `send()` → `loadDispatch()` → `dispatch(closure, {queue, delay})` → worker runs closure → `prompt()` | `stream()+broadcast` → `then`/`catch`.
