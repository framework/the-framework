# Bug analysis: packages/framework/dashboard/components/Quota.tsx

## Business logic (high-level)

The "Usage" card (#960): draws the account's quota week as one bar (used fill, dimmed budget
segment, boundary tick, per-day axis), states pace as durations, hosts the draggable
unattended-work limit, and falls back to precise error wording when the week cannot be placed or
usage cannot be read. Checked against the SPEC section by section:

- **The week as one bar**: `weekDays(startsAt, resetsAt)` (lib/quota-bar) yields calendar-day
  segments with the smaller of a split day's slivers unlabeled; labels centred per segment,
  notches at `days.slice(1)` starts (none at the bar's left edge), used fill at
  `projectedRange().start`, dimmed segment only when `enabled`, boundary tick at
  `clamp(boundary.percent, 0, 100)` drawn continuously. All per SPEC. `weekMs > 0` always
  (boundary spans exactly the quota week), so no division hazards.
- **Colour is the verdict**: one `quotaTone` drives fill, legend swatches, and both coloured
  figures (`TONE_FILL`/`TONE_TEXT` cover all four tones). Per SPEC, including the 5-point band
  (in `quotaTone`).
- **Pace as time**: deviation duration (`paceDeviationMs`, signed; label `Over-`/`Under-consuming`
  with `over = deviationMs >= 0` — exactly-on-pace reads "Over-consuming: 0s", pinned by a test),
  `consumedQuotaMs` spent figure, `paceSharePercent` omitted when the boundary is 0 (start of
  week — per SPEC), reset day, and the "show all limits" tooltip gated `others.length > 1` (only
  when there is a window beyond the week; the listing deliberately includes the week itself — the
  code comment in `Quota()` documents that choice and the test pins the order). Long-form
  tooltips on each figure. All per SPEC.
- **Dragging sets the budget**: the range input spans the full 0–100 bar scale (so the native
  thumb lands on the dimmed edge — the comment explains why min/max must stay 0/100), and the
  change handler converts to an offset: `round(value - boundary.percent)` clamped to
  ±`MAX_SPEND_OFFSET` (50) — mirroring the daemon's own clamp+round in registry.ts, so the value
  sent equals the value stored (important for the pending logic below). Keyboard-operable
  (`aria-label="Unattended work stops at"`). Per SPEC.
- **Autonomous AI on/off**: `enabled = projected.end > projected.start` ⇔ clamped limit above
  clamped used — SPEC's "the handle leaves room beyond what has already been used". Eager warning
  when `limit > boundary.percent + ONE_DAY_PERCENT` with the knob's own deviation
  (`limitDeviationMs`) in the tooltip. Legend names the three parts with the boundary tooltip.
  All per SPEC.
- **A missing week is an error**: bar only when `view.boundary && week`; otherwise, with windows
  present, a `role=alert` from `unplaceableWeek` with the three distinct wordings (no week line /
  week without reset / unrecognized reset phrasing, quoted). The reported windows still list
  under the card in that case. Per SPEC.
- **Say why there is no reading**: `unavailableNote` covers no-subscription, agent-not-found,
  unrecognized (stale vs fresh wording), and the default (failed refresh, stale vs fresh);
  `staleAt` appends "Last read <age>" whenever numbers survive a failed refresh. Per SPEC — with
  one gap, bug 1 below.

Concurrency/UI-state concerns examined: the slider's local/pending latch (`useSpendOffset`)
prevents the snap-back the SPEC forbids; the write path (`updatePreferences`) is internally
caught (no unhandled rejection); the 30s poll keeps last values on failure (useQuota). One hole
in the latch: bug 2.

## Functions (low-level)

### `weekWindow(windows)`

`find(kind === 'week')` — same selector `quotaBoundaryStatus` uses daemon-side, so bar and
boundary can never be about different windows. Correct.

### `unplaceableWeek(week, windows)`

Three-way message; probing confirmed the branch conditions: `!week` → "no line" quoting the
labels that did arrive; `!week.resetsAtText` → the "no span to place it in" wording that does not
claim a parse failure; otherwise quote the unparsed phrasing. Empty `windows` cannot reach it
(caller gates on `view.windows.length`). Correct.

### `WeekBar({ status, percentUsed, offset, onChangeOffset, others })`

All arithmetic delegated to lib/quota-bar (analyzed there: clamps are sound; `projectedRange`
never yields negative width). Verified numerically against the test fixtures (day-label
sequence WE…TU with the leading Tuesday sliver silenced; 8 segments → 7 notches → 10 child divs;
offset clamps at ±50 from both bar ends). The `role="img"` aria-label rounds both percentages.
Range input `step="any"`: keyboard arrows still step (UA default), and each step recomputes from
the *local* offset, so presses accumulate (pinned by test). Edge: with `boundary.percent` late in
the week, `limit` clamps at 100 so the eager warning becomes unreachable — correct, the limit
cannot exceed the bar. Verdict: correct.

### `OtherWindow` / `OtherWindowRow`

One line/row per window, resets text only when present. Keys on `label` — labels are unique in
Claude Code's readout (session / week / per-model weeks). Correct.

### `unavailableNote(view)`

Switch with stale/fresh variants for `unrecognized` and the default reason. Exhaustive for
today's `DriverQuotaUnavailableReason` values plus a default. Correct — but see bug 1 for the
`undefined`-reason-with-empty-windows hole at the caller level.

### `useSpendOffset(serverOffset)`

Local value + `pending` ref: adopt the server value only when no write is outstanding or when the
server has caught up to exactly the pending value. This kills the snap-back (#960) and is correct
for the single-writer case because the daemon stores exactly what this client sends (both sides
round+clamp identically). Hole: `pending` clears only on exact match — see bug 2. Also examined:
initial render before any view has `serverOffset === undefined` → default offset; the effect
adopts the server value as soon as it exists. Correct.

### `Quota()`

Wiring of view → bar/alert/list/note. `staleAt` requires `unavailable !== undefined` AND
`windows.length > 0` — readAt is always set when windows are non-empty (lastGood implies
lastGoodAt). The `!view` "Reading your usage…" line covers only the RPC-unanswered state — see
bug 1 for the answered-but-never-read state. Otherwise correct.

## Bugs found

1. `L441` / `L466-471` (`Quota()` + `unavailableNote`): a `QuotaView` of `{ windows: [] }` with
   `unavailable` **unset** renders a completely empty card body — no bar, no alert, no note, and
   not the "Reading your usage…" line (that shows only while `view` is `undefined`). This state
   is real: the daemon's `pollerQuotaSource.read()` sets `unavailable` only when
   `envelope.latest` exists and failed, and before the poller's first `claude /usage` attempt
   completes (it spawns a CLI; seconds) `latest` is `undefined` — so a dashboard opened right
   after CLI start (the normal flow) gets header-and-nothing for those seconds. Contradicts the
   card's own rule ("Say why there is no reading" — and the test SPEC's "the card says it is
   reading rather than drawing an empty week"; here it says nothing at all). Severity: minor.
   Fix: treat empty-windows-with-no-reason as still reading, e.g. change the guard to
   `{(!view || (!view.windows.length && !view.unavailable)) && <p>Reading your usage…</p>}`.
2. `L406-411` (`useSpendOffset` effect): `pending` clears only when the poll returns *exactly*
   the pending value. If the daemon never echoes it — the preferences write failed (daemon
   restart mid-flight), or another tab moved the slider afterward so the stored offset is now a
   third value — the condition `pending.current !== serverOffset` stays true on every poll and
   the slider is stuck showing the local value forever while the daemon gates work on a different
   one; only another local drag un-wedges it. The module comment assumes "the daemon's catches up
   with it, which is the point at which the two agree" — with a second writer they never do, and
   the project explicitly cares about cross-tab preference staleness (#1148 in
   lib/preferences.ts). Severity: minor. Confidence: the mechanism is certain, the
   multi-tab/failed-write trigger is uncommon. Fix sketch: remember the server value seen when
   the write was issued and also clear `pending` when `serverOffset` changes to anything
   different from that remembered value (a moved server value means a newer write won), or clear
   `pending` once a poll that started after the write has landed.
