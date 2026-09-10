Binds the agent queue [1] to the `agent-data` branch [2] for a long-lived process, the daemon: the write cycle every edit of `TODO_AGENTS.md` lands through (apply to the branch's persistent checkout [3] under `.branches/agent-data`, commit, push), and the sync that brings the daemon's view of the branch up to date: the branch and its checkout exist, an empty queue file is seeded on a branch born without one, and the checkout converges with origin.

## Context

**User story**: the dashboard shows the queue as every machine and cloud session [4] left it, a task the user queues reaches every other machine, and a person browsing the branch finds a `TODO_AGENTS.md` even before the first task is queued, not a mystery.

**Business logic story**: the branch's birth, its sync with origin and the commit-and-push cycle are the `agent-data` package's rules; this file only binds them to the queue. The `queue` command in `cli.ts` does not use the persistent checkout: it writes through a throwaway worktree at origin's tip.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[3] checkout: a git worktree under the project's `.branches/` directory, named as its branch: here "the `agent-data` branch's checkout".
[4] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **The write cycle** - an edit of the queue runs against the persistent checkout at `<root>/.branches/agent-data`, then commits and pushes as one commit, one cycle at a time; a program's edit counts only once pushed.
- **Seeding the queue** - the sync commits an empty `TODO_AGENTS.md` as "seed the queue" when the branch has none, and leaves an existing queue exactly as it is.
- **Converging with origin** - the sync births the branch and its checkout when missing, adopts what origin has, pushes anything an earlier cycle left stranded, and reports why it could not converge ("no remote") instead of throwing.

## Business logic

### The write cycle

#### Context

**Problem**: the daemon edits the queue from several places (a task the user queues from the dashboard, the routines refilling it, a note queued when an agent stops), and each edit must reach origin as one commit or other machines read a stale queue.

#### Business logic

An edit of the queue file is applied to the branch's persistent checkout [3], `<root>/.branches/agent-data`, committed with the edit's own message, and pushed, as one cycle; cycles run one at a time, so two edits never interleave in one checkout. The cycle's own rules are the `agent-data` package's: a cycle that changes nothing commits nothing, a push that loses a race is re-applied on origin's new tip, and a cycle that could not commit restores the checkout. A queue edit counts only once pushed: committed but unpushed is not landed. Reading, writing, removing and listing the branch's files, the cycle itself and the log line are each replaceable by the caller, so every operation on the queue can be judged off disk and off git.

### Seeding the queue

#### Context

**User story**: see `## Context`.

#### Business logic

The sync first runs one write cycle, "seed the queue": when the branch's checkout [3] has no `TODO_AGENTS.md`, an empty one is written and committed; when the file exists, nothing is written and nothing is committed, so a queue written since, by hand or by an agent, is left exactly as it is. A seeding cycle that could not commit ends the sync there, reporting the cycle's error; one that committed but could not push goes on to converge with origin, which pushes it.

### Converging with origin

#### Context

See `## Context`.

#### Business logic

After seeding, the sync brings the branch and its persistent checkout [3] into being when missing and up to date otherwise, by the `agent-data` package's rules: origin's branch is adopted when origin already has one; what other machines and cloud sessions [4] pushed is read; anything an earlier cycle left stranded is pushed; the checkout is left clean between cycles. The sync answers whether it converged and, when it could not, why: a repository with no remote is an error state, told "no remote", and the sync never throws. Running the sync again seeds nothing new and writes nothing.
