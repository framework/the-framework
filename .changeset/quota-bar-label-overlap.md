---
'@gemstack/framework-dashboard': patch
---

Fixed two usage-bar bugs from #960: the day labels overlapped when the quota week starts mid-day (the first, partial day's label sat almost on top of the one beside it — now it drops to a line of its own), and the "unattended work stops at" limit rendered as its own full-width slider underneath the week bar rather than as a handle on it. The limit is now a draggable handle on the same track as the fill and the boundary, so the bar reads as one control instead of two.
