What the tests cover:

- **The week as calendar days** - a week starting mid-day is cut at every local midnight, so the day it starts on appears as two slivers, one at each end of the bar, and only the wider one is labeled; each weekday therefore reads exactly once. A week starting just after midnight labels that day at the start instead, since that sliver is the bigger one. A week starting exactly at midnight has no split at all and every day takes an equal seventh.
- **The segments cover the whole bar** - they run edge to edge with no gap and no overlap, whatever their individual widths.
- **A week with no span** - a reset equal to or before the start of the week draws nothing rather than failing.
- **The day labels are fixed, not localized** - the built-in labels are the two-letter English weekday notation, so the axis distinguishes seven days on any machine, including locales whose short weekdays all begin alike.
- **The color of the week** - consumption well below the boundary reads as under, within five percentage points either side of it as on track, well above it as over, and a fully spent week as full. A week at 100 percent used reads as full even when the boundary has caught up to it, because nothing left is not the same as spending too fast.
- **Pace as a duration** - exactly on pace is zero; a seventh of the week ahead is one day ahead; two sevenths behind is two days behind, with the sign saying which.
- **The room left to project** - it runs from what is used to the line unattended work stops at; it is empty rather than negative once that line is reached or passed; and both ends are kept inside the bar.
- **What has been spent, as time** - a share of the week becomes that much of the week, nothing used is no time at all, and a window reporting past full counts as one spent week rather than more than one.
- **Consumption as a share of the pace** - exactly on pace reads 100, above and below pace read proportionally either side of it, and the week's first moments, where nothing is allowed yet, give no reading rather than an infinite one.
