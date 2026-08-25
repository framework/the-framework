# Bug analysis: packages/framework/src/gate-keepalive.ts

## Business logic (high-level)

Holds the Node event loop open exactly while at least one parked promise (a gate awaiting a pick, a parked chat wait) is pending (#1359), and releases it the moment the last settles — the counter-based inverse of the deliberately-unref'd control watcher. Checked against `gate-keepalive.SPEC.md`: held while any gate pending, overlapping gates share one hold, released on the last answer *or failure*, and afterwards the process can exit "exactly as if this had never applied". All four properties are implemented (shared ref-counted timer; `finally` releases on both resolve and reject; timer stopped and cleared at count zero; fresh timer on a later hold).

Concurrency/ordering analysis: all counter transitions are synchronous on the event loop, so `held++`/`--held` cannot interleave mid-operation. The interesting orderings — a new hold arriving after a settle but before its `finally` microtask runs (count 2→1, timer survives, correct) and back-to-back settle-then-hold in separate ticks (timer stopped then restarted, correct — tested as "a hold after everything settled starts a fresh timer") — behave right. The timer handle is cleared (`timer = undefined`) only after `stop`, and `start` is only called at 0→1, so no double-start or double-stop is reachable.

Timer-value check: `IDLE_INTERVAL_MS = 2**30` ms (~12.4 days) is *below* Node's 2^31−1 timeout ceiling, so the interval does not fall back to 1 ms (which would busy-wake); the no-op callback fires at most every ~12 days during a parked wait. Correct choice.

Reliances (not bugs): if `timers.start()` threw, `held` would already be incremented and the counter would be permanently skewed (the next first-hold would not start a timer) — `setInterval` never throws, and the injected test seam doesn't either. A caller passing a forever-pending promise holds the loop forever — that is the feature (a gate can legitimately wait hours), and stop/abort paths reject the parked promise, which releases via `finally`.

## Functions (low-level)

- **`KeepaliveTimer` / `KeepaliveTimers`** — the seam types; `hasRef` optional so the spy can return `{}`. Correct.
- **`nodeKeepaliveTimers`** — `setInterval(() => {}, 2**30)` (ref'd by default; the test asserts `hasRef()` rather than trusting it) / `clearInterval` with a cast. The cast is safe: `stop` only ever receives what `start` returned. Correct.
- **`createGateKeepalive(timers)`** —
  - `acquire`: post-increment compare `held++ === 0` starts the timer only on the 0→1 edge. Correct.
  - `release`: pre-decrement `--held === 0` stops on the 1→0 edge; `&& timer` guards the (unreachable) started-without-timer state; resets `timer` so a later 0→1 edge starts fresh. Cannot go negative: `release` runs only in `hold`'s `finally`, exactly once per `acquire`. Correct.
  - `hold`: acquire → `await pending` in try → release in finally; returns the value, rethrows the rejection (both tested). Note `hold` rethrows rather than swallowing, so the caller's own error handling still runs — no swallowed rejection. Correct.
  - `held()`: exposes the live count. Correct.

## Bugs found

None found.
