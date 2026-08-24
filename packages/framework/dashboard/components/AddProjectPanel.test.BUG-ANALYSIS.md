# Bug analysis: packages/framework/dashboard/components/AddProjectPanel.test.tsx

## Business logic (high-level)

Pins the six flows its SPEC lists, with the two RPCs mocked (`vi.hoisted` + `vi.mock` before a
top-level `await import` of the component — the correct vitest pattern) and everything else real:

1. Picker asked on mount (`toHaveBeenCalledTimes(1)` immediately after `render` — valid because
   RTL flushes effects inside `act`), path echoed on the trust step, `sendAddProject` **not**
   called until the trust click, then called with exactly the picked path — this genuinely pins
   the trust gate ordering, the SPEC's central promise.
2. `alreadyActivated: true` → "Already added" wording.
3. Dismissed picker (`path: null`) → `onClose` awaited via `waitFor`, and nothing added.
4. Pick failure → reason rendered; "Try again" → second mock answer → trust step. The
   `mockResolvedValueOnce` chaining makes the retry observable.
5. Failed add → daemon's error text rendered *and* the trust button still present (stays on the
   trust step) — asserts both halves of the SPEC sentence.
6. "Choose again" → picker called again, new path replaces the old (asserted by finding
   '/Users/dev/second' and the call count).

Every async transition is awaited (`findByText`/`findByRole`/`waitFor`); `afterEach` cleans up
DOM and resets both mocks, so no cross-test leakage of `mockResolvedValueOnce` queues (reset, not
clear — implementations are re-established per test). None of the tests can pass vacuously: each
asserts either a rendered phase change or a mock call pattern that the component must produce.

Coverage gaps (noted, not defects): no tests for Esc/backdrop/Cancel closing, the focus trap, the
2.5s auto-close, `onAdded` being invoked, or the "Could not reach the daemon." catch path. The
missing Esc coverage is what lets the phase-1 dead-Esc bug (see AddProjectPanel.BUG-ANALYSIS.md
Bug 1) go unnoticed; a `fireEvent.keyDown` test would have to target a focused in-dialog element
to be faithful, which is exactly the condition the component fails to establish.

## Functions (low-level)

- **module setup (L4-8)** — hoisted mock fns; `vi.mock` of `../rpc/projects.js`; dynamic import
  after mocks. Correct.
- **`afterEach` (L10-14)** — `cleanup` + `mockReset` on both fns. Correct.
- **test 1 (L17-29)** — the not-called-yet assertion sits after `findByText` (trust step
  reached), so it proves ordering, not just timing luck. Correct.
- **test 2 (L31-37)** — clicks via `await findByRole` (waits for the trust step). Correct.
- **test 3 (L39-45)** — `waitFor(onClose called)`; also asserts no add. Correct.
- **test 4 (L47-54)** — once/once mock sequencing; asserts both the message and the recovery.
  Correct.
- **test 5 (L56-63)** — error text plus still-on-trust-step. Correct.
- **test 6 (L65-73)** — re-pick replaces the path; call count 2. Correct.

## Bugs found

None found.
