The routine lock: holding one of Auto PM's routines for one machine while it runs, by writing a lock file for that routine on The Framework's own logs branch, `agents-logs`, so no two machines sharing that branch ever run the same routine at once.

## User story

- Auto PM triages the ticket backlog on a schedule. A second triage starting while the first is still in flight would read the same tickets and queue the same work twice.
- The user runs The Framework on more than one machine against the same repo, so a routine one machine has taken has to be visible to the others.
- A daemon killed mid-routine must not leave that routine locked behind it.

## Glossary

- **routine lock** — a routine's `routines/<ROUTINE>.lock.md` file on the logs branch. It names the machine that holds the routine and the moment that machine took it, one line each: `CLAIMED: <machine>` and `SINCE: <timestamp>`. Content missing either line names no holder and is not a lock.
- **write funnel** — the logs branch's single write cycle (sync, apply the change, commit, push), which re-runs the change against origin's fresher state when a push loses a race, and restores the checkout when a cycle fails whole.

## Business logic — TL;DR

- **The routine lock is a file on the shared logs branch** - written and read through the same write funnel as every other write to the branch, so it reaches every machine that shares the branch instead of living in one daemon's memory.
- **An alive lock stands the caller down, naming its holder** - the refusal says which machine holds the routine and since when, so the reason can be read rather than guessed.
- **The taking is decided before anything is started** - the answer is a lock file, not something an agent discovers once it is already running.
- **A commit that could not be pushed still counts as taken** - it guards this machine; the cross-machine gap is logged rather than treated as a failure. A cycle that could not commit at all took nothing and says so.
- **Only the machine a lock names may drop it** - a lock naming anyone else is left standing, whether the release is a routine ending or a boot-time cleanup.
- **A daemon frees, on boot, its own locks whose runs are gone** - so a crash on this machine frees its routines at once instead of at the expiry.
- **Four hours and a lock is dead** - a fixed expiry with no heartbeat: whoever finds an older lock takes it over.

## Business logic

### The routine lock is a file on the logs branch

#### User story

See `## User story`: a routine taken on one machine has to be visible on the others, and to a daemon that restarts.

#### Business logic

A routine's lock is `routines/<ROUTINE>.lock.md` on the logs branch, holding the machine that claimed the routine and the timestamp it claimed it at. It is written, read and removed inside the logs branch's write funnel like every other write to the branch, which is what carries the claim to every machine sharing the branch. Each commit says what it did — locking a named routine, releasing a named routine, or releasing the count of locks a previous daemon left behind — so the branch history reads as what happened.

Nothing here ever throws: it runs on a background job with nothing to catch it.

#### Rationale

The lock cannot be a daemon's memory, because the machines it has to coordinate never shared any. It is the same claim-by-file mechanism a ticket already uses, applied to a routine.

### Taking a lock

#### User story

Auto PM is about to fire a routine that must not run twice at once, and needs to know whether it may — before it spends an agent finding out.

#### Business logic

Taking a lock is one funneled cycle. The routine's lock file is read: an existing lock that is still alive stands the caller down, and the refusal names the machine holding it and the time it took it. An expired lock is taken over in the same commit. A lock naming this very machine at this very moment is this call's own claim seen again when the funnel re-runs the cycle after losing a push race, and still counts as taken; any other alive lock stands the caller down, including one this machine minted for a run that is still going.

A cycle that committed but could not push counts as taken, with the gap logged — other machines cannot see it yet. A cycle that could not commit at all took nothing, and the refusal carries the reason.

#### Rationale

Deciding before the start is the whole point: the guard it replaces was a rule inside the routine's own prompt, so every refusal cost a started agent to discover.

### Releasing a lock

#### User story

A routine has finished, one way or another, and the next firing — here or on another machine — should be able to run it.

#### Business logic

A release removes the routine's lock only while it still names this machine; a lock naming anyone else is someone's live claim and is left alone, as is a routine with no lock at all. It reports whether the lock is dealt with (freed, absent, or someone else's) or whether the cycle could not commit, so the caller can retry rather than lose the release.

#### Rationale

Releasing is the daemon's job, not a pull request's: the routines this guards land their work by writing to a branch directly and open no pull request that could carry a deletion of the lock file.

### Locks a dead daemon left behind

#### User story

The daemon was killed — a crash, a Ctrl-C, a reboot — while a routine held its lock. Nothing in the new daemon's memory knows about that routine, and the user should not wait out the expiry to run it again.

#### Business logic

A fresh daemon can sweep the routines directory for this: every lock naming this machine whose run is gone is removed in a single commit, and the routines freed are reported. Whether a run is still going is answered by the caller, from whether any of this machine's own agents started since the lock was minted is still running — so a routine whose agent survived the daemon keeps its lock. Locks naming another machine are never this cleanup's to release, and files under the routines directory that are not lock files are ignored.

### The fixed expiry

#### User story

A machine goes offline mid-routine and never comes back to release its lock. The routine must not stay locked forever.

#### Business logic

A lock is dead four hours after it was taken, and whoever finds a dead lock takes it over. A mint time that cannot be read at all counts as expired.

#### Rationale

The expiry is fixed and there is no heartbeat: a triage over hundreds of tickets can legitimately run for hours, so the window has to be generous, and a heartbeat would add code and a stream of commits to the logs branch for a case the boot-time cleanup already covers on the machine that matters.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
