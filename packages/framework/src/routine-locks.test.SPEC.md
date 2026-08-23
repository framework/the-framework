What the tests cover: the routine lock — the file that reserves one of Auto PM's routines on the data branch.

- **The lock file.** It lives at `routines/<ROUTINE>.lock.md`, names the machine that holds the routine and the moment it took it, and reads back to exactly that pair; content that is not a lock names no holder.
- **Taking one.** A free routine is locked in one funneled write. A cycle re-run after a lost push race finds this machine's own claim and still counts it as taken, committing once. An alive lock stands the caller down with a reason naming the holding machine and the time it took it, and writes nothing — whether the holder is another machine or this one's own earlier run.
- **The expiry.** A lock four hours old or older is dead and is taken over in the same commit; a minute younger and it still stands.
- **Releasing one.** This machine's lock is removed; a lock naming another machine is left standing; a routine with no lock is a no-op that writes nothing. Each of the three reports the lock as dealt with.
- **A dead daemon's leftovers.** Sweeping this machine's locks frees those whose run is gone and names them, keeps the one whose run is still going, never touches another machine's, and ignores files under the routines directory that are not locks — all in one commit whose message counts what it freed.
- **Two machines, one shared data branch, against real git.** The first machine's lock reaches the shared branch; the second machine reads it there and stands down; the second cannot release what the first holds; and once the first machine's release reaches the branch, the second's next attempt takes the routine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
