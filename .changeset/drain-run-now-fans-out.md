---
"@gemstack/the-framework": patch
---

"Spin up agents working on the AI queue" now does what it says (#1204): the drain routine's Run now fires a drain-only sweep, which fans out to the concurrency setting, one agent per open queue entry, instead of starting a single agent on the first entry. An empty queue is reported on the card rather than the click being borrowed for a rotation job.
