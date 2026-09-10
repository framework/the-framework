Keeps a routine [1] from running twice at once across the machines that share a project's `agent-data` branch [2], through a routine lock [3]: one file per routine on that branch, which the daemon takes before starting the routine's agent [4], drops when that agent ends, and frees on boot when a previous daemon of the same machine left it behind.

## Context

**User story**: the user has Auto PM [5] on for the same repository on a laptop and a desktop; a triage runs on one of them, not on both, and when the machine running it dies the routine is free again within hours at most.

**Problem**: a routine's agent commits nothing on a code branch, so nothing there can tell another machine that the routine is running; the `agent-data` branch is the one thing every machine shares. The decision has to be the daemon's, taken before an agent is started: an agent started only to find out and stand down is quota [6] spent for nothing.

## Glossary

[1] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[3] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[5] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[7] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **The lock file** - `routines/<name>.lock.md` on the `agent-data` branch: two lines, which machine claimed the routine and when.
- **Taking a lock** - one committed and pushed write; a live lock, anyone's, stands the daemon down naming its holder; an expired one is taken over in the same commit.
- **Expiry: four hours** - a lock older than four hours counts as dead; there is no heartbeat.
- **Releasing** - the daemon that took a lock removes it when the routine's agent ends, however it ended; another machine's lock is never touched.
- **Freeing on boot** - a booting daemon removes every lock of its own machine whose agent is gone.

## Business logic

### The lock file

#### Context

See `## Context`.

#### Business logic

A routine's lock is the file `routines/<routine name>.lock.md` on the `agent-data` branch [2], beside the skills' own files. It holds two lines: `CLAIMED: <the machine's host name>` and `SINCE: <the time it was taken, as an ISO timestamp>`. A file under `routines/` without both lines is not a lock and is ignored.

### Taking a lock

#### Context

**Problem**: two daemons may try to take the same lock at the same moment, and the same daemon may find its own lock again when its write is retried.

#### Business logic

The lock is taken through the `agent-data` branch's [2] one sync → commit → push cycle, under the commit message "[The Framework] lock the <name> routine". Inside the cycle the lock file is read first. When it names a live lock, whether another machine's or this machine's own from an agent [4] still going (a daemon restarted under a running routine, say), the daemon stands down, nothing is written, and the reason names the holder: "<name> is already running on <host> (since <time>)". When there is no lock, or the lock is expired, the file is written with this machine's host name and the current time. When the push loses a race with another writer, the cycle re-runs the step against the fresher branch: a lock another machine took in between is then found and respected rather than overwritten, while this call's own claim seen again is recognized as ours. The outcome is "ours" when the commit landed. When the commit landed but the push did not, the lock is still ours, and a log line says other machines cannot see it: "routine locks: the <name> lock could not be pushed, so other machines cannot see it". When not even the commit landed, the routine is not started, with the reason "the <name> lock could not be committed (<error>)". Taking a lock never throws: it runs on a background tick [7] with nothing to catch an exception.

### Expiry: four hours

#### Context

**Problem**: a machine that crashes mid-routine leaves its lock on the branch, and no other machine can tell a crash from a long triage.

#### Business logic

A lock counts as dead once four hours have passed since its `SINCE` time, or when that time cannot be read as a date. One minute younger than four hours is still alive. The limit is fixed and there is no heartbeat: a triage over hundreds of tickets can take hours, and a heartbeat would cost code and churn on the `agent-data` branch [2].

### Releasing

#### Context

**Business logic story**: a routine [1] never opens a pull request, so nothing downstream frees the lock; the daemon that took it releases it when the routine's agent [4] ends, whatever the ending.

#### Business logic

Under the commit message "[The Framework] release the <name> routine", the lock file is removed only when it names this machine as its holder. A lock naming another machine, and no lock at all, are left alone and reported as dealt with: someone else's claim outranks the cleanup. Only a release whose commit could not land is reported as not done, so the caller can retry it.

### Freeing on boot

#### Context

**Problem**: a daemon that boots is not the daemon that took the locks its machine holds, so nothing in memory will ever release them.

#### Business logic

On boot the daemon lists every `<name>.lock.md` under `routines/` and removes each that names this machine and whose agent [4] is gone. Whether the agent is gone is the caller's judgment from the lock's `SINCE` time: whether an agent of this machine started at that time is still going. Locks of other machines, and files under `routines/` that are not locks, are left alone. All removals land as one commit, "[The Framework] release <n> routine lock(s) left by a previous daemon", and the names released are reported only when that commit landed.
