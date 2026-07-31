---
'@gemstack/the-framework': minor
'@gemstack/framework-dashboard': minor
---

The ticket lock is now the `.lock.md` file the ticketing format defines (#1420), replacing the PENDING placeholder mechanism: the daemon claims a ticket by writing and pushing `tickets/<STEM>.lock.md` (`CLAIMED: <AGENT_ID>`) before the agent starts, the fanned-out agent deletes the lock in the same commit as its plan, and the 6-hour staleness release is gone — a lock stands until the work lands or a human lifts it with the dashboard's new Release-lock button (`sendReleaseTicketLock`). Tickets show a "claimed" badge with the holder while locked.
