# Bug analysis: packages/framework/dashboard/components/Quota.test.tsx

## Business logic (high-level)

A thorough suite (30+ tests) pinning everything the test SPEC lists: the reading state, the bar's
aria description, per-day axis labels/notches, one-bar-only with "show all limits" tooltip, the
handle's bar-scale value + offset storage + accumulation + ±50 clamps, the two-segment fill and
its absence when the limit is under the used share, enabled/disabled wording and tooltips, the
eager-consumption warning threshold and its real-deviation tooltip, the row layout, the footer's
duration figures (deviation / spent / % of pace / reset), the three unplaceable-week alerts, and
the unavailable wordings (fresh vs stale variants, "Last read" ageing).

Mocking is at the right seams: `useQuota` is replaced by a module-level `view` variable (the
component's only data source), `updatePreferences` by a spy (its only write). Everything else —
quota-bar arithmetic, format-date, the real Base UI tooltips — runs for real, so the assertions
pin end-to-end wording and geometry, not mock echoes.

Fixture verification (probed with node): `STARTS_AT` (2026-07-21 19:00 local) is indeed a Tuesday
— the mid-day-start case; `weekDays` yields 8 segments with the leading Tuesday sliver unlabeled,
so the expected label sequence `['WE','TH','FR','SA','SU','MO','TU']` and the 10-child-div count
(7 notches + used + dimmed + boundary) are correct, not fitted to a wrong date. The arithmetic
expectations also check out: boundary 4/7 → "57%"; 20% used → deviation −2.6d → "2d"; 50% used →
3.5d floored "3d spent"; 60% vs 57.14% → 105% of pace; offsets 20/40 → "1 day"/"2 days" faster;
clamps: value 100 at day-1 boundary → +86 → 50, value 0 at day-6 boundary → −86 → −50.

Test-quality checks:

- Timezone sensitivity: `new Date(2026, 6, 21, 19:00)` is local-time, so the *weekday* is Tuesday
  in every zone (local construction + local `weekDays` midnights agree) — the label expectation is
  zone-safe; only exotic zones with non-midnight-aligned offsets would perturb segment widths,
  and no width is asserted in that test. Sound.
- Whitespace: the JSX source renders "⚠️  Eager consumption" (two spaces); `getByText('⚠️ Eager
  consumption')` passes because testing-library's default normalizer collapses runs of spaces.
  Sound, if fragile-looking.
- Async: every tooltip interaction goes through `openTooltip`, which is awaited and itself
  `waitFor`s the `role=tooltip` popup — no unawaited opens; synchronous assertions elsewhere are
  genuinely synchronous renders.
- No test can pass vacuously: each queries concrete elements (`getBy*` throws when missing) and
  most assert exact strings or numeric closeness.
- `mainFigureTrigger()` anchors on the "resets …" text's `<p>` then takes the *first*
  `.cursor-default` — the deviation trigger by DOM order; if the figure order changed the exact
  `textContent` assertions ("Under-consuming: 2d") would fail rather than silently pass.

Coverage gaps (noted, not bugs): the empty-view-without-reason state (`{windows: []}` with no
`unavailable`) is untested — that is exactly the blank-card hole reported against Quota.tsx (bug
1 there); a test asserting "Reading your usage" for that view would have caught it. The
`useSpendOffset` pending-never-clears path (Quota.tsx bug 2) is likewise untested (would need a
re-render with a changed `view`). Neither gap makes an existing test wrong.

## Functions (low-level)

### `openTooltip(trigger)`

mouseEnter + pointerEnter (pointerType mouse) then awaits the popup. Matches Base UI's
open-on-hover with the kit's delay 0. Correct.

### `mainFigureTrigger()`

See above — anchored query, deliberate because the trigger's text is split across nodes. Correct.

### `reading` / `readingAt`

Build a `QuotaView` whose boundary mirrors the daemon's shape (`limit.percent` clamped the same
way `quotaBoundaryStatus` computes it); the component recomputes limit from `offset` anyway, so
the fixture cannot mask a divergence — and the handle tests assert the recomputed value. Correct.

### The suite

Individual tests verified against the implementation and lib arithmetic (see high-level). Two
worth calling out as genuinely regression-proof rather than mirror tests: the accumulate test
(two successive changes assert the *second* is computed from the first's local value, the exact
#960 snap-back), and the two clamp tests (which need `readingAt`'s day parameter to place the
boundary far enough from the bar's ends — correctly chosen at days 1 and 6). Verdict: correct.

## Bugs found

None found.
