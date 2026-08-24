# Bug analysis: packages/framework/dashboard/lib/quota.test.ts

## Business logic (high-level)

Tests `useQuota` end-to-end against a mocked `onQuota`: undefined until the first answer, pass-through of the view, 30s refresh, keep-last-on-failure, and stop-after-unmount. These duplicate `use-async.test.ts` at one remove — deliberate, since they pin the *binding* (the hook really polls `onQuota`, really at 30s, really with `undefined` initial) rather than the generic hook. `useAutoPm` is untested here; it is byte-for-byte the same shape, so the gap is cosmetic.

Fake-timer discipline is right: `vi.useFakeTimers()` in beforeEach, `advanceTimersByTimeAsync` inside `act` via `settle`, real timers restored in afterEach. The unmount test advances 90s (three ticks' worth) and asserts the call count stayed 1 — a genuine leak detector for the interval.

## Functions (low-level)

- `view(percentUsed)` — minimal `QuotaView` fixture; `percentUsed` disambiguates readings. Correct.
- `settle(ms)` — `advanceTimersByTimeAsync` inside `act`; flushes both the timer tick and the resolved RPC's state application. Correct.
- "undefined until the first answer" — asserts the pre-answer `undefined` synchronously after `renderHook` (before any flush), then the answer. Can fail if the initial value or the first read regressed. Correct.
- "refreshes on its interval" — swaps the mock, advances exactly 30_000, asserts the new view. Would fail if the cadence constant or interval wiring changed. Correct.
- "a failed refresh keeps the last view" — rejection at the tick, value retained; vitest would also surface an unhandled rejection if the swallow regressed. Correct.
- "stops polling once unmounted" — one call before unmount, none in 90s after. Correct.

## Bugs found

None found.
