Implements the lock every process on one clone takes before it touches a branch's persistent checkout [1], so that the daemon, the scheduler and each run take turns in it.

## Context

**User story**: a scheduled run ends while the scheduler is pulling the `agent-data` branch on the same machine; the run's record still lands, and the dashboard shows the run as it ended.

**Problem**: the daemon, the scheduler and each run are separate processes writing through one checkout. A failed write cycle of one resets the checkout and removes its untracked files, which wipes the change another has written but not yet committed; that one's commit then fails with nothing to commit, and a run's end record is lost.

## Glossary

[1] persistent checkout: the checkout of a branch used as a file store, at `<repository>/.branches/<branch>`, kept between writes (the rule in `file-branch.ts`).

## Business logic — TL;DR

- **One lock file per checkout** - `<repository>/.branches/<branch>.lock`, created only when absent, holding the holder's process id and a random token.
- **Wait for a live holder** - while another running process holds the lock, the process checks again every tenth of a second, five minutes at most, then gives up with the reason.
- **Take over a gone holder** - a lock whose process is no longer running, or that stayed empty for ten seconds, is removed and taken.
- **Let go of only its own lock** - when done, whatever the work did, the process removes the lock only while the file still holds its own token.

## Business logic

### One lock file per checkout

#### Context

See `## Context`.

#### Business logic

The lock of a branch's persistent checkout [1] is the file `<repository>/.branches/<branch>.lock`, beside the checkout, hidden from git with the rest of `.branches/`. A process takes it by creating the file only when no such file exists (one step, so two processes can never both succeed) and writing its process id and a random token into it. The `.branches/` directory is created first when missing.

### Wait for a live holder

#### Context

See `## Context`.

#### Business logic

When the file exists and names a process that is still running on this machine, the process waits a tenth of a second and tries again. After five minutes it gives up: the work is not run, and the failure says that another process has held the lock for longer than that. A file that disappears between the attempt and the read is tried again at once.

### Take over a gone holder

#### Context

**Problem**: a process killed while it held the lock never removes it, and every later write would wait forever.

#### Business logic

A lock whose process id names no running process is removed and the attempt made again. A lock file that is still empty ten seconds after it was made (its maker died between creating and writing it) is treated the same way.

### Let go of only its own lock

#### Context

**Problem**: a process that removed the lock file after another had taken it over would let a third process in beside the second.

#### Business logic

When the work ends, successfully or not, the process reads the lock file and removes it only when it still holds this process's own token. Removing a gone holder's lock follows the same rule: it is removed only while it still holds what was read.
