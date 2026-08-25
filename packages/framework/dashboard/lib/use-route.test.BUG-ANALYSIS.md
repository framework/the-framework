# Bug analysis: packages/framework/dashboard/lib/use-route.test.ts

## Business logic (high-level)

Tests for `useRoute`, driving the real jsdom History API (no mocks — the point of F1's removal of
Vike). `beforeEach` normalizes to `/` via `replaceState` so history length drift between tests
cannot change outcomes that use relative comparisons.

Claim-by-claim:
- "reads the route from the live URL" — sets `/my-repo/run-1` then asserts the parsed
  `{projectId, agentId}`. Exercises parseRoute through the hook. Genuine.
- "navigates ... and the hook re-reads it" — `act(go)` then asserts both `location.pathname` and
  the hook's `route`, i.e. the push AND the notify. Can fail if `notify()` is dropped.
- "a navigation is a history entry" — asserts `history.length > 1` and the final pathname. Uses
  `>` rather than an exact count because jsdom's history is shared across the file; acceptable
  and non-flaky (two pushes guarantee > 1). It cannot distinguish one push from two, but the
  next test pins the exact-count behavior for replace.
- "replaces the history entry when asked" — captures `history.length`, replace-navigates, asserts
  the length is unchanged and the pathname moved. Watch: jsdom caps history length at 50 like
  browsers? At the cap, push would also leave length unchanged and the test would pass vacuously
  — but this suite performs ~6 navigations total, nowhere near a cap. Sound.
- "does not add a history entry for where it already is" — starts at `/my-repo`, `go` to the same
  route, asserts unchanged length. Pins the early-return. Genuine.
- "follows Back and Forward" — replaces state and dispatches a synthetic `PopStateEvent` inside
  `act`, because jsdom's `history.back()` is async; asserts the hook re-read. This tests the
  subscription path (the `popstate` listener), which is exactly what it claims.

All state updates go through `act`, assertions are synchronous afterwards — nothing unawaited.
`renderHook` unmount (implicit via test isolation) removes the window listener through the
subscribe cleanup, so listeners do not stack across tests.

## Functions (low-level)

- `at(path)` — replaceState helper; avoids growing history in setup. Correct.
- Each `it(...)` as analyzed above; every assertion is falsifiable against a real regression
  (dropped notify, wrong replace flag, missing same-URL guard, missing popstate wiring).

## Bugs found

None found.
