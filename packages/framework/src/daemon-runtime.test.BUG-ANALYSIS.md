# Bug analysis: packages/framework/src/daemon-runtime.test.ts

## Business logic (high-level)

Unit tests for the two waits in daemon-runtime.ts — `waitOutFinishedLeg` (#1529/#1540, the Resume-vs-mid-exit race) and `waitOutSlots` (shutdown's "killing a pid is not letting go of the repo"). They pin the decision tables exactly as `daemon-runtime.test.SPEC.md` states; the full daemon path is covered elsewhere (the E2E settings story), so these deliberately drive the seams with hand-built slot maps.

For `waitOutFinishedLeg`: a free slot returns without even reading the leg state (asked === 0); `running` short-circuits fast and leaves the slot for the busy guard; `ended` is waited out until the slot clears; the wait is bounded when the slot never clears; a parked retirement is awaited even after the slot cleared; a rejected retirement does not reject the wait; `unknown` is re-asked rather than taken for live (asked > 1) and a later `running` still short-circuits (the states array is fully consumed); `ended` is never re-read (asked === 1).

For `waitOutSlots`: untouched slots return at once; a slot whose pid-clearing `settle` and teardown appear mid-wait is still waited out (`torn === true`); a worktree-less run parks nothing and holds nothing up; a rejected teardown does not reject the shutdown; and the wait is bounded when the slot never clears.

Do they verify what they claim? Yes — each asserts observable effects (call counts, slot residues, elapsed-time bounds, side-effect flags) and every promise is awaited. Timing margins are safe: 25ms internal polls vs 40–90ms fixture timers and 5s ceilings; the two "bounded" tests use a 120ms grace and assert `elapsed >= 120`, which cannot flake in the fast direction.

The one behavior the suite does **not** pin is exactly where the implementation deviates from its SPEC: both "bounded" tests leave the slot in `activeAgents` with nothing in `retiring`, exercising only the `delay(step)` poll path. A test parking a never-settling promise in `retiring` (e.g. `new Promise(() => {})`) would hang today — the unbounded-await bugs recorded in `daemon-runtime.BUG-ANALYSIS.md` (L301/L351). Coverage gap that mirrors the production gap; the existing tests themselves are correct.

## Functions (low-level)

- `sleep(ms)` / `emptySlots()` — fresh `{starting, activeAgents, retiring}` per test, so no cross-test state. Correct.
- `a free slot returns immediately` — counts reads; expects zero. Matches the early-return. Correct.
- `a leg still calling itself running` — elapsed < 1s (vs 5s grace) and the slot left in place. Correct.
- `a finished leg is waited out` — slot removed by a 60ms timer; asserts it is gone afterwards (i.e. the wait actually waited). Correct.
- `the wait is bounded (leg)` — 120ms grace sat out, slot still held, falls through to the guard. Correct (poll path only, see above).
- `a retirement already in flight is awaited` — retiring parked before the call, slot never occupied → straight to the final await; `retired` flag proves the promise was awaited, not just observed. Correct.
- `a retirement that failed does not fail the continuation` — pre-rejected promise in `retiring`; the `.catch(() => {})` in the implementation absorbs it. Note the raw `Promise.reject` is handed to the function synchronously, so no unhandled-rejection window materializes in practice on Node's next-tick detection. Correct.
- `an unreadable leg is asked again` — slot cleared at 90ms, every 25ms iteration re-reads while `unknown`; asserts the exit was waited out *and* asked > 1. Correct.
- `unknown then running short-circuits` — the shifted states array must be fully consumed (`states.length === 0`), elapsed < 1s, slot left. Pins "keeps asking until it commits". Correct.
- `ended is not re-read` — asked === 1 while the loop spins on `delay` until the 90ms clear. Pins the `ended` latch. Correct.
- `slots nothing has touched return at once` — elapsed < 1s. Correct.
- `a slot whose exit has not landed yet` — the fixture reproduces `settle` faithfully (delete live slot, park teardown that self-deletes), and `torn === true` proves the mid-wait-appearing teardown was awaited. This is the gap the function exists to close, and the test genuinely exercises it. Correct.
- `a run with no worktree` — slot clears, `retiring` stays empty; no special case needed. Correct.
- `a teardown that throws does not fail the shutdown` — rejected promise plus a 40ms map cleanup (mirroring `parkRetirement`'s finally); the loop's `.catch` absorbs the rejection and the cleanup lets the loop exit. Correct.
- `the wait is bounded (slots)` — 120ms sat out, slot still held, gave up rather than hanging. Correct (poll path only).

## Bugs found

None found. (The missing never-settling-`retiring` case is a coverage gap tracked with the production bugs on `daemon-runtime.ts` L301/L351, where the fix belongs.)
