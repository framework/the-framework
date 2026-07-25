---
'@gemstack/the-framework': patch
---

A session that has finished now offers the step that finishes it. The dashboard treated "the process is up" as "the agent is working", but a settled session stays alive to take your next message, so its arming checkboxes never gave way to the action they describe and a finished session had nothing to click. It now switches when the agent settles, offers one button named Open PR rather than a Push branch / Open PR pair nobody could tell apart, and says why in the cases where there is nothing to open — no commits, no branch, no remote.
