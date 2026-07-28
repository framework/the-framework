Dependency-free runs-per-day bar chart over the activity window (#471), with a hover read-out.

## TLDR

- Renders `ActivityDay[]` as flex-column bars anchored to the baseline, single hue (primary token), no legend.
- Each column sits over a faint full-height track so a zero day reads as an empty slot, not a gap.
- Hovering a column swaps the center caption to `MM-DD · N sessions`; default caption is the total over the window.
- End label says "today" only when the last data key equals the local calendar date — a stale board must not claim it.

## Decisions

- Columns are plain divs, not buttons (#948): they act on nothing, and as buttons a keyboard user tabbed through 14 focusable no-op controls.
- No `title` attribute: read-out data rides the hover caption and the group's `aria-label`, so the slow system tooltip never doubles the instant read-out (#1149).
- Date keys are local `YYYY-MM-DD` (`localDateKey`), matching how the chart's data is written; labels display the `MM-DD` slice.
