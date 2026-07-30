---
'@gemstack/framework-dashboard': patch
---

Stopping a settled session no longer blanks its view to "This session has no events." until a manual refresh (#1383). When a run ends, the view swaps its live events for the archived log — but the archive read answers `[]` both for "gone" and for "not archived yet", and a Stop races the archive write, so the swap could replace a populated feed with nothing. An empty archive now counts as not-there-yet: the events already on screen keep their place, and the empty-state line is reserved for a session that truly has no events anywhere.
