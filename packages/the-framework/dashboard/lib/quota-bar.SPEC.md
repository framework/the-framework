The arithmetic behind the usage bar — purely about drawing the week; where the spending boundary sits and what it gates is decided framework-side and never re-derived here.

## Flows

- Draws the quota week as real calendar days: segments run local midnight to midnight, so a day's width is how much of it is actually in the week. A week that starts mid-day splits that day across the bar's two ends; it is labeled once, at whichever end holds more of it.
- Day labels are a fixed two-letter notation, not the viewer's locale — two letters of a localized weekday do not distinguish the days in every language.
- The bar's colour compares consumption to the boundary with a tolerance band, so on-pace jitter does not flicker it; a fully spent week reads "full", not "over".
- The auto-work limit line is computed locally so it moves the instant the slider does; the room between used and limit draws as a dimmer projected stretch.
- The pace gap shows as real time ("2h ahead", "1d behind"), which says more than a share of the week. Consumption converts to the same unit, so the two figures beside each other share a scale instead of asking the reader to convert one into the other.
- A second reading puts consumption against the allowance elapsed so far rather than against the whole week, because that elapsed allowance is the line that actually parks unattended work. While it is still zero — the very start of the week — the reading is omitted rather than shown as infinite.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
