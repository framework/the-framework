---
'@gemstack/the-framework': patch
---

Queueing a ticket now places it in a `## Priority N` section of `TODO_AGENTS.md` per the backlog format, and the entry links back to the ticket it came from. It used to be appended to the end of the file, which meant a ticket you deliberately queued was worked last, behind everything already there, and the entry carried nothing but a title so the ticket was lost the moment it was queued.
