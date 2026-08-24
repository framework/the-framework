# Bug analysis: packages/framework/dashboard/lib/quota-bar.test.ts

## Business logic (high-level)

Exercises every export of `quota-bar.ts`. The `weekDays` suite is the substantial part: mid-day start labelling the bigger sliver (both the evening case, label at the end, and the after-midnight case, label at the start), exact-midnight start with equal sevenths, edge-to-edge tiling, and the empty/inverted span guard. The suite injects its own `getDay()`-based `weekday` helper for the structural tests (timezone-independent because the fixture dates are constructed in local time), and separately pins that the *built-in* formatter is a fixed two-letter notation — genuinely proving locale independence rather than assuming it (the test would fail on a he-IL-locale machine if the formatter used the machine locale).

Timezone sensitivity check: fixtures use `new Date(2026, 6, 21, …)` (local-time constructors) plus a flat `startsAt + WEEK_MS` reset, and boundaries are re-derived local midnights — so on a machine where that particular week crosses a DST change (e.g. Southern Hemisphere transitions), day widths differ but every assertion made (label placement by *larger sliver*, tiling, filtered label sequence) still holds: the 19h-vs-5h and 22h-vs-2h comparisons survive a ±1h shift. No hidden flakiness.

Remaining suites pin the tone band (including `full` beating `over` at boundary 100), signed pace deviation in week-ms, projected-range clamping and empty-not-negative behaviour, consumed-time clamping both directions, and share-of-pace including the undefined-at-zero-boundary rule. All assert concrete values; none are vacuous.

## Functions (low-level)

- `weekday` helper — indexes `['SU'..'SA']` by `getDay()`; equivalent to the production label for en-US. Correct.
- `weekDays` tests — label arrays with the `undefined` sliver in the right position; width comparison for the labelled TU; tiling loop asserting `start[i] === end[i-1]`, `0` and `100` at the ends; `[]` for empty/inverted spans. Correct and failure-capable.
- Built-in-label test — filters out the unlabelled sliver, asserts the full sequence. Correct.
- `quotaTone` tests — under/near(low edge)/near(high edge)/over/full, plus the boundary-100 pair. Correct.
- `paceDeviationMs` tests — zero on pace; ±day-sized deviations with `toBeCloseTo`. Correct.
- `projectedRange` tests — room, empty-at-passed-limit, clamp both ends. Correct.
- `consumedQuotaMs` tests — half-week, one-seventh, zero, >100 and negative clamps. Correct.
- `paceSharePercent` tests — 100 on pace, both sides, undefined at zero boundary (for both zero and non-zero usage). Correct.

## Bugs found

None found.
