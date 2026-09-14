Tells the daemon's own commits on the `agent-data` branch [1] apart from everyone else's, so the daemon can react to a move of the branch without reacting to itself, and two daemons sharing a branch cannot fire at each other. Every automatic write the daemon makes goes through one funnel that signs the commit; the trigger counts only the commits without the signature.

## Context

**User story**: someone queues a task on another machine; within a minute this machine's daemon starts an agent on it. The agent's run ends and the daemon records it on the same branch; nothing starts because of that record, here or on the other machine.

**Problem**: the daemon starts a run when the branch moved by a commit it did not write itself (the rules in `auto-pm.ts`). Its own commits — a run's record at teardown, a routine lock [2], a claim [3] minted for a plan agent — look like anyone else's, and the branch is shared with other machines' daemons, whose records look the same. Without a mark, every record would start the next run, forever, and two daemons would fire empty runs at each other's records without end.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[2] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] a move: a commit on the `agent-data` branch that no daemon wrote — a person queuing an entry, an agent claiming, closing or marking done.
[5] trailer: a `Key: value` line at the end of a git commit message, after a blank line, which git reads back by key.

## Business logic — TL;DR

- **The daemon's funnel signs its commits** - every write the daemon makes on its own goes through the persistent checkout's write cycle with `Daemon: <machine name>` as the commit message's last line, a trailer [5]; a person's write from the dashboard takes the skills' plain funnel and carries none.
- **The head of the branch** - the local head of the project's `agent-data` branch, or nothing when the branch does not exist yet.
- **Counting the moves** - between two heads, the commits whose message carries no `Daemon:` trailer are the moves [4]; a range git cannot walk counts as none, and the daily heartbeat is the belt for it.

## Business logic

### The daemon's funnel signs its commits

#### Context

See `## Context`.

#### Business logic

The funnel is the persistent checkout's serialized write cycle on the `agent-data` branch [1] (the shared branch library's): sync with the remote, apply the change, commit, push. What this module adds is the message: the caller's message, a blank line, then `Daemon: <machine name>`, the machine being this host's name. Every skill library the daemon writes through accepts a caller's funnel, and the daemon hands this one to each automatic write: the run's record at teardown and the surrogate end at boot (`daemon-runtime.ts`, `daemon.ts`), the routine locks and the plan claims and their releases (`daemon-services.ts`), and the patch of a run's card when a cloud session's branch is adopted. A write a person makes from the dashboard — queue an entry, release a claim, delete a run — takes the skill's own funnel and carries no trailer: a person asking for work is exactly what should start a run.

### The head of the branch, and counting the moves

#### Context

**Problem**: the daemon must read two things off git and nothing else about the branch: where it stands, and whether it moved by someone else's hand.

#### Business logic

The head is the project's local `agent-data` branch ref; a repository without the branch has no head, which the sweep reports as a branch it cannot read. Between two heads, the commits in the newer's history but not the older's are listed with the value of their `Daemon:` trailer [5]; a commit with no such trailer is a move [4], and the count of those is what the sweep acts on. A word `Daemon` in the body of a message is not a trailer and does not count. When git cannot walk the range — the older head was rebased away after a push the daemon could not land — the count is zero, and the daily heartbeat is the belt.
