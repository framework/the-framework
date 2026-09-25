The run's lock [1]: one process per run [2] at a time. A run's process holds its run's lock from before it touches the run record [3] until it has let the checkout [4] go. A second process for the same run waits until the holder is gone: a resume that comes while the run still records and reclaims [5], or two resumes started together by two messages. The sweep [6] leaves a run alone while its lock is held. Per machine, like the pid in it. Beside the lock, the same directory holds the stderr file a spawned run's process writes to, so a run that dies before writing anything leaves a trace.

## Context

**User story**: the user sends a run a message just as it ends, or two messages in quick succession; each is handled after the one before, in the same run, and never by two agents working the same checkout at once; meanwhile no tick's sweep records a run failed while its process is still booting, working, recording or reclaiming.

**Business logic story**: the run's process (`run.ts`) takes the lock for a run and for a resume; a detached run's parent (`runner.ts`: `run --detach`, and a scheduler's tick through the same spawn) takes it before the run's process exists and hands it over once it does; the sweep (`sweep.ts`) asks who holds it. This file also holds the one probe of a live pid the package uses, which the scheduler imports too, and where a spawned run's stderr lands.

## Glossary

[1] the run's lock: `.agent-runner/runs/<id>.lock` at the repository root, holding the pid of the process that holds it. A pid that is not a live process holds nothing.
[2] run: one agent this tool starts: a process of the tool's own (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`).
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] reclaim: removing a finished agent's checkout once its work is on the remote.
[6] sweep: the pass that records and reclaims the runs of this machine whose process died, and only this machine's; the scheduler runs it on every tick.

## Business logic — TL;DR

- **A live pid** - probed by signal 0 on this machine; a process that exists but belongs to another user counts as alive; a pid on another host is unknowable here.
- **The holder** - the pid in the lock file when it is a live process; none when there is no file, it holds no positive whole number, or its pid is dead.
- **Taking the lock** - a free lock is written with the taker's pid; a lock already naming the taker's pid is its own at once; a lock held by a live process is looked at again every 500 ms until it is not; a lock whose pid is dead, or that names no pid, is removed and taken. The tool's directory `.agent-runner/` is hidden from git first, so the lock never dirties the tree.
- **Handing the lock over** - a detached run's parent hands the lock to the run's own process: the file is rewritten with the new pid, only when it still names the parent's.
- **Letting it go** - the file is removed, only when it names the releasing pid.
- **A known limit** - two waiters taking over a dead holder's lock in the same instant can both believe they hold it.
- **The spawned run's stderr** - `.agent-runner/runs/<id>.stderr`, beside the lock.

## Business logic

### A live pid

#### Context

**Problem**: a pid means something only on the machine that owns it; the lock, the sweep, and the scheduler's `start`, `stop` and `status` all ask the same question of one.

#### Business logic

A pid is a live process when signal 0 reaches it on this machine, or when the answer is that it exists but this user may not signal it. A pid on another host is unknowable here; the lock and the sweep only ask about this machine's.

### The holder

#### Context

See `## Context`.

#### Business logic

The lock file is read; its content, trimmed, is the holder's pid when it is a positive whole number. The holder is that pid when it is a live process; otherwise, and when the file is missing or unreadable, the run's lock is held by no one.

### Taking the lock

#### Context

**Problem**: a resume must not start while another process of the same run still writes its record or reclaims its checkout, or the two would work the same checkout and write over each other's record. A process that died must not keep its run locked forever.

#### Business logic

The directory `.agent-runner/runs/` is made, and `/.agent-runner` is added to the repository's exclude file (best-effort), since the tool's directory must not dirty the tree. Then, over and over: the lock file is created with the taker's pid only if it does not exist, and when that succeeds the lock is taken. When it exists, its pid is read: the taker's own pid means the lock is the taker's already (a detached run's process finds the lock its parent handed it), and it goes on at once; no pid, or a pid that is not a live process, means the file is removed and the creation tried again; a live holder means waiting 500 ms before looking again. There is no time limit on the wait.

### Handing the lock over

#### Context

**Problem**: a detached run's process does not exist yet when its parent decides to start it, and a sweep in that moment must not read the run as gone.

#### Business logic

The parent takes the lock with its own pid before the run's process is spawned; once spawned, the lock file is rewritten with the run's process's pid, only when it still names the parent's pid. A hand-over from a process that does not hold the lock changes nothing.

### Letting it go

#### Context

See `## Context`.

#### Business logic

The lock file is removed only when it names the pid letting it go; a process that no longer holds the lock (it was taken over, or handed on) removes nothing.

### A known limit

#### Context

**Problem**: taking over a dead holder's lock is a remove then a create, not one step.

#### Business logic

Two waiters that both find the holder dead in the same instant can each remove the file and each go on believing it holds the lock. The case needs a holder that died, which is the sweep's case already.

### The spawned run's stderr

#### Context

**Problem**: a detached run's process can die before its session opens, leaving nothing in the checkout or on the branch that says why; the sweep needs a trace to record.

#### Business logic

A spawned run's process has its stderr appended to `.agent-runner/runs/<id>.stderr` at the repository root, the process that spawns it making the directory when missing (`runner.ts`). The sweep reads the file when it ends a marker with no checkout behind it (`sweep.ts`).
