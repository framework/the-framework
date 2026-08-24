# Bug analysis: packages/framework/dashboard/lib/use-async.test.ts

## Business logic (high-level)

Directly tests the shared read hooks with fake timers and parked promises. `useLoaded`: initial-until-answer, null-load never reads, dep change resets then re-reads (asserting the intermediate `'initial'` so cross-target bleed is caught), a read landing after its deps changed is dropped (real out-of-order resolution), rejection keeps the last value with the comment noting vitest fails on an unhandled rejection. `usePolled`: interval re-read, stop after unmount (50s advanced, count pinned at 1 — a genuine interval-leak detector), rejection mid-poll with recovery on the next tick, immediate `reload`, reload-cannot-write-after-unmount (parked promise resolved post-teardown), and null-load never polls. Together these pin every SPEC clause except `keepPrevious` and `loaded`, which are exercised by consumer tests (`use-agents`, quota) — a coverage gap here, not a wrong assertion.

Async discipline: all timer advances inside `act`; parked promises resolved inside `act`/`settle` before asserting; `renderHook` prop-driven dep changes via `rerender`. The dropped-late-read test resolves `a` only after `b` is asserted — order genuinely matters and would catch a token regression.

## Functions (low-level)

- `settle(ms)` — `advanceTimersByTimeAsync` in `act`. Correct.
- `useLoaded` suite — five tests as summarised; the deps arrays used (`[]`, `[undefined]`, `[id]`) match the closures, honouring the contract. Correct.
- `usePolled` suite — six tests as summarised. The unmount-reload test destructures `reload` before unmount (identity from the last render) and relies on it reading the shared `liveRef` — exactly the mechanism under test. Correct.
- Timer hygiene — fake timers per test with real-timer restoration. Correct.

## Bugs found

None found.
