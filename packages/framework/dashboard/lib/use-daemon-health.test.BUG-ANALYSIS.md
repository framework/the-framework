# Bug analysis: packages/framework/dashboard/lib/use-daemon-health.test.tsx

## Business logic (high-level)

Two rendered-component tests for the probe: an answering daemon reads `healthy` (asserted only after the RPC was actually called, so it verifies the probe fired rather than just the optimistic initial state — though the initial `true` would make the *text* assertion pass either way, the `toHaveBeenCalled` wait keeps it honest), and a failing probe flips to `down` (the load-bearing case, since `down` is reachable only through the rejection path — this one cannot pass vacuously).

Uncovered (noted, not bugs): the 5s cadence, the no-pile-up chaining, recovery back to `healthy`, and unmount cleanup are untested — they would need fake timers. The rejection test also implicitly proves the rejection is handled (vitest fails a run on an unhandled rejection).

Timer hygiene: real timers; each probe schedules a 5s follow-up which `cleanup()` (afterEach) cancels via the effect teardown before it fires — no cross-test bleed, no stray RPCs against a reset mock.

## Functions (low-level)

- `Probe` — renders `healthy`/`down` from the hook; minimal and sufficient. Correct.
- "an answering daemon reads healthy" — resolve mock, wait for the call, assert text. Correct.
- "a failing probe flips to down" — reject mock, `waitFor` the flipped text. Correct.
- Hygiene — `vi.hoisted` mock, top-level `await import` after `vi.mock`, `cleanup` + `mockReset` per test. Correct.

## Bugs found

None found.
