---
'@gemstack/the-framework': patch
---

Two fixes from the #1364 post-merge review. The spike-lock commit now pushes to origin's default branch — and only when the checkout is on it; before, it pushed `HEAD:<current branch>`, which published whatever branch the daemon's checkout happened to be on and left main-forked machines blind to the locks. `SPIKE_LOCK_STALE_MS` goes from 60 minutes to 6 hours: spiking and planning can take hours, and staleness release is a recovery mechanism that ideally never fires.
