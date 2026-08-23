What the tests cover: the quota bar's arithmetic.

- **Days along the bar** - a quota week starting in the evening labels the weekday it straddles at the end of the bar, where most of that day falls, while one starting just after midnight labels it at the start; either way each weekday reads exactly once. A week starting exactly at midnight has no split day and every day is an equal seventh. The day stretches tile the bar edge to edge whatever their widths. A week with no duration, or an inverted one, draws nothing. The built-in day names are a fixed two-letter notation rather than the machine's language, since a localized abbreviation would label every day identically in some languages.
- **Colour** - consumption reads as under, near, over or full against the quota boundary, with a margin either side of the boundary counting as near; a fully spent week reads as full even on the last day, when the boundary has caught up to it, because nothing left is a different thing from spending too fast.
- **Gap from pace** - zero exactly on pace, positive when ahead and negative when behind, expressed as real time within the week.
- **Projected stretch** - it spans from what is used to the quota limit while there is room, is empty rather than negative once the limit is reached, and is held inside the bar at both ends.
- **Consumption as quota time** - a share of the week converts to that much of the week; nothing used is no time; and a window reporting past full counts as one spent week, never more, with a negative reading counting as none.
- **Share of pace** - exactly on pace reads as one hundred percent, with faster and slower spending either side of it; before any allowance has elapsed there is no reading at all rather than an infinite one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
