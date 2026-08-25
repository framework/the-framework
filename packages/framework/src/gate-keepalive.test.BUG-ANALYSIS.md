# Bug analysis: packages/framework/src/gate-keepalive.test.ts

## Business logic (high-level)

Five tests covering every SPEC clause of the keepalive: first-hold-starts / settle-stops, overlap-shares-one-timer with last-settler-releases, rejection-releases-and-rethrows, restart-after-idle, and the one integration-grade assertion — the *real* Node timer is ref'd (`hasRef() === true`), which is the entire point of #1359 (a spy-only suite would pass with an unref'd, useless timer; this test closes that hole and cleans up its real interval in `finally` so the test process can exit).

Honesty check:

- `spyTimers()` counts starts/stops via getters; `live()` = started − stopped. It cannot mask double-stops (stopped would exceed started and `live()` would go negative, failing the `=== 0`/`=== 1` asserts) — adequate observability for the contract.
- `deferred()` uses definite-assignment resolvers; the Promise executor runs synchronously, so `resolve`/`reject` are assigned before use. Sound.
- The synchronous assertion `timers.live() === 1` immediately after `keepalive.hold(...)` correctly pins that acquisition is synchronous (an async acquire would leave a gap where Node could exit — the very bug). Good, deliberate-looking placement.
- The overlap test awaits `heldGate` before asserting `live() === 1`, so the release path for the first hold has definitely run — no timing luck involved (the `finally` release runs before the `await heldGate` continuation completes the test's next line... precisely: `heldGate` settles only after `hold`'s finally executed, so the assertion is race-free).
- The rejection test uses `assert.rejects(held, /watcher died/)` and then checks `live() === 0` — both awaited; no floating promise. All async tests `await` everything they create; the deferred promises are all settled, so no test leaves a pending hold behind.
- The restart test distinguishes `started === 2` from `live()`, catching a stale-timer-reuse implementation.

No test is vacuous; each maps to a distinct SPEC clause. Nothing in the suite depends on real time (the spy replaces timers; the one real-timer test only inspects the handle synchronously).

## Functions (low-level)

- **`spyTimers()`** — counter seam, described above. Correct.
- **`deferred()`** — standard out-of-band resolver helper. Correct.
- **Test 1 (start/stop)** — pins 0→1 and 1→0 edges plus `held()` bookkeeping. Correct.
- **Test 2 (overlap)** — pins single shared timer (`started === 1`) and last-settler release. Correct.
- **Test 3 (rejection)** — pins release-on-failure and rethrow. Correct.
- **Test 4 (restart)** — pins fresh timer per idle period. Correct.
- **Test 5 (real ref)** — pins `hasRef()` on the real `setInterval` handle; `try/finally` stops it. The `hasRef?.()` optional call would yield `undefined` (failing the assert) rather than throwing if the handle shape changed — a failure, not a false pass. Correct.

## Bugs found

None found.
