The arithmetic behind the usage bar — purely about drawing the week; where the spending boundary sits and what it gates is decided framework-side and never re-derived here.

## TLDR

- Draws the quota week as real calendar days: segments run local midnight to midnight, so a day's width is how much of it is actually in the week, and a mid-day start's split day is named once, at whichever end holds more of it.
- Day labels are a fixed two-letter notation, not the viewer's locale — two letters of a localized weekday do not distinguish the days in every language.
- The bar's colour compares consumption to the boundary with a tolerance band, so on-pace jitter does not flicker it; a fully spent week reads "full", not "over".
- The auto-work limit line is computed locally so it moves the instant the slider does; the room between used and limit draws as a dimmer projected stretch.
- The pace gap converts to real time ("2h ahead", "1d behind"), which says more than a share of the week.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
