# Bug analysis: packages/framework/dashboard/lib/notify-channels.test.tsx

## Business logic (high-level)

Tests the #1095 shared store through real React rendering: one daemon read however many readers mount together, a reload settling every reader at once, and a failed read keeping the last known state. Matches `notify-channels.test.SPEC.md` claim for claim. The tests correctly treat the cache as module state that outlives a test (beforeEach re-primes via mock + reload instead of assuming an unread store) — an honest accommodation of the design.

Ordering dependence worth noting: the first test ("several readers … do not each ask") relies on the cache being `null` (or a load being in flight) when the readers mount — true on first run in file order. If the suite were reordered so a prior test had populated the cache, the readers would skip `load()` entirely and the assertion `onQuota…not.toHaveBeenCalled()` would still pass — i.e. the test would silently stop testing the dedupe, though it would not false-fail. As written (this test runs first, cache starts null, a pending promise is parked in `inFlight`) it genuinely exercises the dedupe: the three mounting readers each call `load()` and all join the parked promise. Not a bug, but fragile to reordering.

## Functions (low-level)

- `Reader` — renders `loading` / `configured` / `none` off `useNotifyChannels()`; three-state so both the null phase and both boolean answers are distinguishable. Correct.
- Test 1 (dedupe) — parks a pending promise via `reloadNotifyChannels`, clears the mock's call count, mounts three readers, settles, asserts zero further RPCs. Genuinely fails if the dedupe regresses (each reader would then call the cleared mock). Correct.
- Test 2 (reload settles all readers) — loads `empty`, then swaps the mock to `configured` and reloads; asserts both readers converge. Can fail (e.g. if `notify` stopped fanning out, or the cache were per-hook). Correct.
- Test 3 (failed read keeps state) — loads `configured`, reloads against a rejecting mock, waits 20ms of real time, asserts unchanged. The fixed 20ms sleep is enough for a rejected promise's microtask chain; a `waitFor`-style negative assertion is inherently time-bound but the rejection settles in microtasks, so the window is sufficient. Also implicitly asserts no unhandled rejection (vitest fails on one). Correct.
- Hygiene — `vi.hoisted` + `vi.mock` for the RPC; top-level `await import` after mock registration; `cleanup` after each; `mockReset` + default resolve in `beforeEach`. Correct.

## Bugs found

None found.
