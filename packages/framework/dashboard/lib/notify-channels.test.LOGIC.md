What the tests cover:

- **One question for the whole page** - several places showing the channels at once join the read already under way instead of each asking the daemon.
- **A change settles everywhere at once** - after a credential is saved, every place showing the channels reports it as configured together, rather than one at a time as separate timers come round.
- **A failed read keeps the last known state** - a daemon that stops answering leaves the channels reading as they last did, instead of flipping to "not configured" and claiming a credential went away.
