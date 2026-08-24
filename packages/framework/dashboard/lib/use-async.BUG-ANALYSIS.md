# Bug analysis: packages/framework/dashboard/lib/use-async.ts

## Business logic (high-level)

The one read pattern for every panel (`useLoaded` once-per-deps, `usePolled` on a cadence), extracted because the hand-rolled copies mostly forgot to catch. SPEC guarantees and how each is met:

- **A failed read keeps the last answer, never crashes** — `apply`'s `.catch(() => {})`; `value` untouched, `loaded` untouched (a failure is not an answer). Holds.
- **A late answer is discarded** — per-effect `token = {live:true}`; cleanup (dep change or unmount) flips it; `apply` checks before writing. `reload` reads `liveRef.current` — the *latest* token — so an imperative refetch can also not write after a switch/unmount. Holds.
- **Nothing to read means nothing asked** — `load === null` short-circuits after the reset, returning a cleanup that still kills the token. Holds.
- **Switching clears first / `keepPrevious` opt-out** — `setValue(initialRef.current)` unless `keepPrevious`; `initialRef` captures the first render's initial so callers can pass literal `[]`/`{}` without churn (a *changed* initial on later renders is ignored — documented contract). `setLoaded(false)` always, so "not read yet" resets per target even when the stale value is kept. Holds.
- **"Not read yet" is not "not there"** — `loaded` set only by a successful read. Holds.
- **Immediate re-read** — `reload` runs `apply` with the live token, no interval reset (the next tick still fires on the old schedule — an extra read soon after a reload, harmless). Holds.
- **Repeating stops when the panel does** — `clearInterval` in cleanup. Holds.

Concurrency/ordering considered:

- Overlapping reads (a slow read + the next tick, or tick + reload) both carry the same token; whichever *resolves* last wins, which can momentarily be the older data if responses invert — self-healing at the next tick, inherent to last-write-wins polling. Accepted; noted only.
- StrictMode double-effect: first token dies at the first cleanup; the second effect re-reads. No double-write.
- `reload` before the first effect commits reads the initial dead token `{live:false}` — the fetch happens, the write is dropped. Unreachable from event handlers (effects run before interaction).
- `deps` own the effect (`eslint-disable` with the "load closes over exactly these" contract); `apply` is `useCallback([], …)` and touches only refs/setters — sound.
- `reload`'s `useCallback(deps)` — identity changes with deps so it closes over the current `load`. Correct.

## Functions (low-level)

- `useAsyncValue(load, initial, everyMs, deps, keepPrevious)` — as analysed. The `everyMs === null` branch (useLoaded) returns the token-killing cleanup without an interval. Off-by-one: the first read is immediate (`agent()` before `setInterval`), ticks follow — matches "read now, again every…". Verdict: correct.
- `apply(token, agent)` — `void`-ed promise with then/catch; no unhandled rejection path. Verdict: correct.
- `useLoaded(load, initial, deps, keepPrevious)` — `everyMs: null` wrapper returning `.value`. Verdict: correct.
- `usePolled(load, initial, everyMs, deps, keepPrevious)` — passthrough returning the triple. Verdict: correct.

## Bugs found

None found.
