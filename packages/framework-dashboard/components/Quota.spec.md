The Usage panel (#960): the account's quota week as one track — used fill, dimmed "budget for Autonomous AI" segment, a boundary tick at the exact current instant — with the unattended-spend limit as a draggable handle on the same bar.

## TLDR

- Reads `useQuota()` (`QuotaView`); the bar draws only when both a placeable `boundary` and a `week` window exist. Replaces the two flat meters of #519/#879, which drew the week and the boundary as separate bars with no shared axis.
- `WeekBar`: calendar-day labels and white notch delimiters sized by each day's actual share (`weekDays` — a mid-day week start leaves one day split into two same-named slivers, only the larger labelled); used segment at full opacity, projected budget same tone at opacity-35, neither rounding its own corners (one bar, not two pills); boundary as a continuous line — the same value the daemon acts on, never a once-a-day jump.
- Tone (`under|near|over|full` from `quotaTone` → success/info/warning/danger) colours fill, dimmed segment, and the pace-deviation text on one scale.
- Main figure is a duration, not a percent: "Over-/Under-consuming: 2d" via `paceDeviationMs` — "53% used" said almost nothing about whether today's pace held.
- The limit handle is a native `<input type="range">` valued on the bar's own 0–100 scale; the change handler converts to a boundary-relative offset, clamps to ±`MAX_SPEND_OFFSET`, and writes `updatePreferences({ autoSpendOffset })`.
- The legend row also states "Autonomous AI enabled/disabled" (whether the limit leaves room past used, with tooltips defining each) and a "⚠️ Eager consumption" warning once the limit clears a full day (`ONE_DAY_PERCENT`) above the boundary, naming the actual deviation.
- Other windows (session, per-model week) hide behind a "show all limits" tooltip rendered as a real table (each column must line up across windows); with no bar they list directly — they are data, not a fallback.
- Failure states: unparseable week → `role="alert"` quoting the reset text that failed; retained-but-stale readings dated "Last read …" (`readAt`); `unavailableNote` maps `no-subscription`/`agent-not-found`/`unrecognized` to actionable prose.

## Problems

- Slider snap-back: bound straight to the 30s-polled value, each keypress recomputed from the same stale number, so twenty arrow presses moved the limit by one. `useSpendOffset` keeps the local value with a `pending` ref until the server echoes it — the point at which the two agree anyway.
- A native range thumb's position is always `(value−min)/(max−min)` of the box, so min/max must stay exactly 0/100 for the thumb to sit on the dimmed segment's edge; the ±50 offset reach is therefore enforced in the change handler, not by the input.

## Decisions

- No fallback for an unplaceable week: the old quiet degradation to a plain figure hid a real defect for weeks — Claude Code rephrased its reset times, the parser missed, and nothing said the boundary was gone. The failing text is quoted because it is the bug report.
- `unrecognized` with retained windows reads as stale, not terminal (#960): the poller survives an unrecognized readout, so the note says the numbers are from the reading before; with nothing retained it says "Trying again shortly."
- The eager warning fires only a full day past the boundary: the knob rests half a day ahead by default (`DEFAULT_SPEND_OFFSET`), so slightly past is the normal state.
- Warning and enabled/disabled status share the legend's right-hand group, warning first — it explains why the state beside it deserves a second look.
