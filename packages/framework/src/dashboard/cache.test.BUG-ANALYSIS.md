# Bug analysis: packages/framework/src/dashboard/cache.test.ts

## Business logic (high-level)

Pins the cache's five SPEC behaviors: shared single flight, serve-then-refresh on staleness, the cold-ask budget with `pending`, failure keeping the last good value, and on-demand invalidation. The tests are deterministic by design: "slow" loads are hand-resolved `deferred()` promises rather than sleeps, staleness is driven by an injected `now()` clock, and settling of background then-chains is awaited with one `setImmediate` (`settle()`), which runs after all pending microtasks — sufficient for the `.then` handlers involved.

State isolation is handled with `beforeEach(clearCache)` — necessary because the cache is module-global.

What the tests do *not* cover (and where the source's one real defect lives): invalidating while a refresh is in flight, and a cold load rejecting with no prior value (asserted only indirectly). Also uncovered: two concurrent *stale* readers (single flight is only tested cold). Noted as gaps, not test bugs.

## Functions (low-level)

- `deferred<T>()` — the definite-assignment pattern for exposing resolve/reject; correct and leak-free.
- `settle()` — `setImmediate` wrapper; adequate ordering guarantee for the microtask chains under test (verified against the source's promise structure: resolve → `.then` store → macrotask).
- 'concurrent asks for the same key share one call (#1028)' — two `cachedRead`s started before the gate resolves; asserts `calls === 1` and both get the value. Both calls are started synchronously in the same tick, which is exactly the single-flight window. Budget 50ms is comfortably above the immediate resolution — no flake. Correct.
- 'a known value answers without calling again, until it is stale' — call-count pinned at 1 across two reads; clock advanced past ttl; the third read still gets the old value (the SWR guarantee — the caller never pays), `settle()`, then the fourth gets the refreshed one and `calls === 2`. Correct and precise.
- 'a first ask slower than the budget reports pending…' — asserts the exact `{value: undefined, pending: true}` shape (the comment rightly stresses pending ≠ "no PR"), then resolves, settles, and the next read has it. Correct.
- 'a failed read keeps the last good value rather than dropping it' — attempt 2 throws; the stale read still answers v1 immediately, and after settle the value remains v1. The third `cachedRead` also *re-fires* a refresh (attempt 3 succeeds returning 'v3') — but the assertion reads the value *before* that background refresh lands, so it still sees v1; deterministic because the value is read synchronously from the entry. Correct (though it quietly leaves a v3 refresh in flight at test end; harmless, `clearCache` runs next).
- 'invalidate forces the next read to go again' — call-count 1 → invalidate → 2. Correct.

All assertions await their promises; nothing can pass vacuously (each asserts on concrete values/call counts).

## Bugs found

None found.
