# Bug analysis: packages/framework/dashboard/components/BrowserPanel.test.tsx

## Business logic (high-level)

Pins down the #946 failure-recovery behavior of `BrowserPanel`, exactly matching
`BrowserPanel.test.SPEC.md`:

1. img error → "not reachable" + Retry; Retry restores the stream on a fresh URL (`r=1`) and hides
   the Retry button.
2. A second failure latches only attempt 1 and can be retried to `r=2`.
3. A failure on agent r1 is not inherited when the same mounted panel switches to r2.
4. Returning to previously-failed r1 renders the stream again (no replayed latch).

All four behaviors are real projections of the component's `failedKey`/`attempt`/`lastBase` state
machine, and each assertion can fail if the corresponding logic regresses (e.g. reverting the
adjust-during-render reset makes tests 3 and 4 fail; dropping `?r=` from the src fails tests 1–2).

Not covered (component behavior tested nowhere): coordinate translation (`toPageCoords`), the input
`send` POSTs, the key filter, the `onFrame` still capture, inline-vs-rail styling. Coverage gap,
not a test bug (InlineBrowser tests cover the onFrame contract from the consumer side with a mock).

Mechanics: everything is synchronous (`fireEvent.error` → setState → rerender), so the absence of
async/await is right, not lazy. `afterEach(cleanup)` present. No mocks needed — the `<img>` never
actually loads in jsdom, and no error event fires spontaneously there, so the panel stays in stream
state until the test fires one. The tests do trigger real `fetch` calls? No — no click/wheel/key
events are fired, so `send` never runs; no unmocked-network hazard.

## Functions (low-level)

### `frame()` helper (L7)

`getByAltText("The agent's browser")` — throws when absent, which tests exploit (calling `frame()`
after recovery doubles as an existence assertion). Correct.

### Test 1 (L10–21)

Renders, fires error, asserts img gone + message present; clicks Retry; asserts `src` contains
`r=1` and the Retry button is gone. The `r=1` check verifies the cache-busting attempt counter.
Correct, falsifiable.

### Test 2 (L23–31)

Error → Retry → error → message → Retry → `r=2`. Verifies the latch is per-attempt (a regression
that latched a boolean without keying would keep showing the failure after the second Retry, or
never show it after the first). Correct.

### Test 3 (L33–43)

Uses `rerender` (same mount) to switch `agentId` — precisely the no-remount scenario #946 is about.
Asserting `frame()` succeeds also proves the failure screen is gone. Asserts the new src path
`/browser/p/r2/stream`. Correct.

### Test 4 (L45–52)

r1 fails → r2 → back to r1, asserts stream renders with the r1 path. Note it does not assert
`r=0`/attempt reset explicitly, but `frame()` succeeding proves `failedKey` no longer matches.
Correct.

## Bugs found

None found.
