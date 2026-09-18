Binds the agent queue [1] to the `agent-data` branch [2]: the write cycle every library edit of `TODO_AGENTS.md` lands through (apply to the branch's persistent checkout [3] under `.branches/agent-data`, commit, push).

## Context

**Business logic story**: the branch's birth, its sync with origin and the commit-and-push cycle are the `agent-data` package's rules; this file only binds them to the queue. The `queue` command in `cli.ts` does not use the persistent checkout: it writes through a throwaway checkout at origin's tip.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs. Born as an orphan, written through one sync → commit → push cycle.
[3] checkout: a git worktree under the project's `.branches/` directory, named as its branch: here "the `agent-data` branch's checkout".

## Business logic — TL;DR

- **The write cycle** - an edit of the queue runs against the persistent checkout at `<root>/.branches/agent-data`, then commits and pushes as one commit, one cycle at a time; a program's edit counts only once pushed.

## Business logic

### The write cycle

#### Context

**Problem**: a task the user queues from the dashboard must reach origin as one commit, or other machines read a stale queue.

#### Business logic

An edit of the queue file is applied to the branch's persistent checkout [3], `<root>/.branches/agent-data`, committed with the edit's own message, and pushed, as one cycle; cycles run one at a time, so two edits never interleave in one checkout. The cycle's own rules are the `agent-data` package's: a cycle that changes nothing commits nothing, a push that loses a race is re-applied on origin's new tip, and a cycle that could not commit restores the checkout. A queue edit counts only once pushed: committed but unpushed is not landed. Reading, writing, removing and listing the branch's files and the cycle itself are each replaceable by the caller, so every operation on the queue can be judged off disk and off git.
