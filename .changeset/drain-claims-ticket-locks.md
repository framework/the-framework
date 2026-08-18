---
'@gemstack/the-framework': minor
---

A drain now claims its entry's ticket with a committed, pushed `.lock.md` before its agent starts, closing the last gap #1420 named: planning already made this cross-machine claim, but implementation runs were booked only in the daemon's memory, so two daemons on different machines could implement the same ticket. Only entries that link back to a ticket are claimed — a self-contained TODO has nothing on disk to lock and keeps the queue document as its coordination point — and an entry whose ticket was claimed elsewhere is dropped from the batch for a later tick to reconsider, never re-implemented. The drain's prompt carries the same claim contract the pinned plan prompt does: the agent removes the ticket, its plan, and its lock in the PR that closes it, and stops if the lock names someone else. A drain-mode claim skips only on an existing lock, since the plan it also finds is the drain's input rather than a rival's work.
