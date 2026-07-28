Pure arithmetic for drawing the weekly usage bar (#960): day segments, tone, limit line, pace deviation, and projected range — DOM-free and React-free so it tests without a component.

## TLDR

- Where the boundary sits and what it gates is the framework's (`quota-boundary.ts`); this only draws the week and never re-derives it.
- `weekDays(startsAt, resetsAt)` — segments run local midnight to local midnight, so a segment's width says how much of that day is in the week and the axis places `TU` where most of Tuesday is. A mid-day start splits its weekday into two same-named slivers (tail right after the start, whole day right before the reset): both delimited, but only the larger keeps its label so the day reads exactly once. Empty/inverted spans return `[]`.
- `quotaTone(percentUsed, boundaryPercent)` — `under`/`near`/`over`/`full` with a ±5-point band; ≥100 is `full` even when the boundary caught up (nothing left is a different thing from spending too fast).
- `limitPercent(boundary, offset)` — the automatic-consumption limit, clamped 0–100. The daemon computes it too and its answer gates the work; this exists so the panel draws the line the instant the slider moves rather than a poll (≤30s) later, which would read as a broken slider.
- `paceDeviationMs` — the gap to the boundary as a signed duration within the week (positive = ahead/over-consuming); "53% used" said nothing about pace, "2h"/"1d" says exactly how much of the week the gap is.
- `projectedRange(used, limit)` — the bar's second, dimmer segment (used → limit), clamped, empty (never negative-width) once the limit is reached.
- `ONE_DAY_PERCENT` (100/7) — how far past the boundary the limit must drift to flag as deliberately eager: the default limit already rests half a day ahead, so a few points past is the normal state.

## Decisions

- Weekday labels are pinned to en-US two-letter codes (`TU`), not the viewer's locale: two characters of a localized short weekday are only distinguishing in locales that work like English (Hebrew's all begin the same), so the axis is fixed notation and full dates are spelled out elsewhere. The formatter is injectable for tests.
- Midnight is re-derived each step (`setHours(24,0,0,0)`) rather than adding 24h, so a DST change does not slide every later boundary by an hour.
- The tone band exists because on-pace consumption drifts a little either side of the line between readings; a point comparison would flicker colours for noise.
