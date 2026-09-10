What the tests cover:

- **The lock file** - its path is `routines/<name>.lock.md`; its content is the `CLAIMED:` and `SINCE:` lines, which read back as the holder and the time; content without them is no lock.
- **Taking a lock** - the lock is written through the `agent-data` branch's write cycle under the message "[The Framework] lock the <name> routine"; when the cycle re-runs the write after a raced push, the daemon's own fresh claim is still recognized as its own.
- **Standing down** - a live lock of another machine refuses the routine, naming that machine and the time, and nothing is written; a live lock of this machine's own from an earlier agent refuses it too.
- **Expiry** - a lock exactly four hours old is dead and taken over in the same commit; a lock one minute younger is alive and refuses.
- **Releasing** - this machine's lock is removed under the message "[The Framework] release the <name> routine"; another machine's lock is left in place; no lock at all is dealt with without writing anything.
- **Freeing on boot** - this machine's locks whose agent is gone are removed and named, one whose agent is still going is kept, another machine's lock is never this boot's to release, a non-lock file under `routines/` is ignored, and the removals land as one commit counting them.
- **Across machines, against real git** - with two clones of one origin, the first machine's lock reaches origin's `agent-data` branch; the second machine is refused and told the first holds it; the second cannot release the first's lock; once the first releases it, origin no longer has it and the second machine takes it.
