# Bug analysis: packages/framework/dashboard/components/ErrorBoundary.test.tsx

## Business logic (high-level)

Pins the four #1194 behaviors: pass-through when healthy (and no alert), the recoverable alert on
a child throw (message surfaced, crashed subtree gone), the console trace with the stable
"Dashboard render error:" prefix, and Try-again re-mounting the children once the cause passed
(rerender flips `crash` before the click — the correct way to model a transient cause with a
controlled thrower).

Harness details verified:

- `console.error` silenced in `beforeEach` (React logs caught errors loudly) and restored in a
  second `afterEach` — both `afterEach` hooks (cleanup + restore) run; order is irrelevant here.
- Test 3 re-calls `vi.spyOn(console, 'error')` on the already-mocked method — returns the same
  spy, so its `mock.calls` include the boundary's log from this test's render; the assertion
  scans for the exact first argument, which cannot be satisfied by React's own logging. Correct
  and falsifiable (removing the `componentDidCatch` log fails it).
- `Boom` throws during render — the only kind of error a boundary catches, so the fixture matches
  the mechanism under test.
- Test 4's sequence (rerender crash=false while the fallback is up, then click) exercises exactly
  the reset-then-fresh-mount path; asserting both the healthy content and the alert's absence.

Coverage gap (not a bug): the Reload button (`window.location.reload`) is untested — reasonable,
jsdom reload is a stub and the wiring is trivial.

## Functions (low-level)

- `Boom({ crash })` (L17): conditional thrower. Correct.
- Tests 1–4 (L23, L33, L49, L59): as analyzed above; queries by role/text; all synchronous, which
  matches the component (no async paths). Correct.

## Bugs found

None found.
