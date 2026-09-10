What the tests cover:

- **A transient failure keeps the last good reading** - after a good reading, a failed fetch becomes the latest attempt while the good reading and its time still stand, the failure time is recorded, and polling goes on; an answer in an unrecognized shape is treated the same way, since one unhandled answer is not a verdict on the account.
- **Backing off** - each refused fetch doubles the gap before the next read, from five minutes to ten to twenty; a timeout repeated many times stretches the gap no further than thirty minutes; the first good reading after failures returns the gap to five minutes.
- **Recovering after a bad first read** - a first reading in an unrecognized shape followed by a good one leaves the poller running, with the good reading retained and the gap back at five minutes, so the usage bar comes back instead of staying blank for the daemon's whole life.
- **An authoritative failure ends polling** - an account with no subscription quota stops the poller and discards the retained good reading and its time; a coding agent that is not installed stops it as well.
- **A driver that fails outright** - a read that throws counts as a failed fetch, the attempt tells nothing, and polling goes on.
- **Stopping is final** - stopping twice is harmless, and starting a stopped poller does not revive it.
