# Bug analysis: packages/framework/dashboard/lib/quota-bar.ts

## Business logic (high-level)

The quota bar's drawing arithmetic (#960/#1367): calendar-day segmentation of the quota week, the colour band, the limit line, pace/consumption as durations, share-of-pace, and the projected stretch. Deliberately draws only — the boundary itself is the framework's (`quota-boundary.ts`), never re-derived here. Checked against `quota-bar.SPEC.md`:

- **Days are calendar days** — boundaries at local midnights via `setHours(24,0,0,0)` re-derived per step (so a DST shift moves only the day it happens in, not every later boundary; matches SPEC). Non-positive span → `[]` (`!(span > 0)` also catches NaN inputs). The loop terminates: `setHours(24,…)` always advances to the next local midnight, strictly later even across DST transitions.
- **Boundary tiling** — `bounds = [startsAt, midnights…, resetsAt]`; a reset exactly on a midnight is not double-pushed (`cursor < resetsAt` is strict, then `resetsAt` appended once). Segments therefore tile 0→100 with no zero-width segment: a start exactly at midnight makes the first bound the midnight itself and the next bound a full day later.
- **Each day named once** — only when `days.length > 1` and the first and last labels collide (a 7-day week starting mid-day) is the smaller sliver's label dropped; ties (`firstWidth === lastWidth`, both exactly 12h) keep the first — a defined choice. Weeks are always 7 days, so the only same-label pair possible is first/last; the guard is sufficient.
- **Fixed two-letter labels** — `Intl.DateTimeFormat('en-US', {weekday:'short'})` sliced to two, upper-cased; locale-independent by construction (SPEC rationale: Hebrew's short weekdays are indistinguishable in two characters). The viewer's *time zone* still applies via `Date`, as intended.
- **Colour band** — `full` at ≥100 checked before `over`, so day-seven's boundary=100 case reads `full` not `over` (pinned by the test); `near` within ±band (inclusive on the low edge, exclusive above — asymmetry is invisible at band granularity); `under` below. Correct.
- **Limit line** — boundary+offset clamped to [0,100]. Correct.
- **Durations** — `paceDeviationMs` signed, unclamped (a deviation can legitimately exceed the boundary's own share); `consumedQuotaMs` clamps to [0,100]% per SPEC ("spent its week, not more than one").
- **Share of pace** — undefined at `boundaryPercent <= 0` (start of week; also guards a negative/garbage boundary). Correct.
- **Projected stretch** — start = clamp(used), end = max(start, clamp(limit)): empty (zero-width at `start`) once used ≥ limit; both ends inside the bar. Correct.

## Functions (low-level)

- `weekdayLabel(at)` — allocates a formatter per call (perf only; called ≤8 times per render). Correct.
- `weekDays(startsAt, resetsAt, weekday?)` — covered above. Percentages are exact ratios of epoch-ms; floating error is far below a pixel. Injectable `weekday` keeps tests timezone-honest. Verdict: correct.
- `quotaTone(percentUsed, boundaryPercent, band=5)` — order full → over → near → under. Negative `percentUsed` → under. Verdict: correct.
- `ONE_DAY_PERCENT` — 100/7, the "deliberately eager" threshold consumed elsewhere. Constant, correct.
- `limitPercent(boundaryPercent, offset)` — min/max clamp. Verdict: correct.
- `paceDeviationMs(percentUsed, boundaryPercent, weekMs)` — linear map to signed ms. Verdict: correct.
- `consumedQuotaMs(percentUsed, weekMs)` — clamp then scale. Verdict: correct.
- `paceSharePercent(percentUsed, boundaryPercent)` — guard then ratio×100. Verdict: correct.
- `projectedRange(percentUsed, limit)` — clamps as above. Verdict: correct.

## Bugs found

None found.
