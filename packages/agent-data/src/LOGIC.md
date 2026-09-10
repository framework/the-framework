The library every skill builds on: a branch of the project's repository used as a file store, checked out under `.branches/`, written through one sync → apply → commit → push cycle that re-applies the change when the push loses a race, and read from anywhere in the repository; underneath it, one way of running git with a time budget per subcommand, and one way of hiding a path from git without touching a tracked file. In the product the branch is the `agent-data` branch [1], and its writers are the daemon, through the branch's checkout [2], and the commands agents [3] run, one-shot from any clone. `git-exclude.BUG-ANALYSIS.md` is an analysis note and carries no code.

## Context

**User story**: every machine and cloud session working a project shares one set of tickets, one agent queue and one record of runs, without the user ever seeing a commit on a code branch or a diff in the project's tracked files.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The two names** (`names.ts`) - `.branches`, the directory holding a project's persistent checkouts, and `agent-data`, the branch every skill keeps its files on; spelled once, importable from browser code.
- **Running git** (`git.ts`) - one runner with a time budget per subcommand (10 seconds for a read, 30 for a local mutation, 120 for the network or a whole checkout), a timeout that is its own failure kind, the line of a failure worth showing, and a push to `origin` that reports rather than throws.
- **Hiding the checkouts from git** (`git-exclude.ts`) - one ignore rule appended once to git's own `info/exclude` in the common git directory, so every worktree is covered and no tracked file changes.
- **The branch as a file store** (`file-branch.ts`) - the branch's checkout under `.branches/<branch>`, its birth as an orphan or adoption from origin, the serialized write cycle with its lost-race re-apply and its no-force rule, the pull, the reads from anywhere that never fail, and the one-shot write from any clone.
- **The entry point** (`index.ts`) - what every skill and the product import.
- **The tests** (`git.test.ts`, `file-branch.test.ts`) - the budgets and failure readings of the git runner; the whole life of the branch against real repositories: birth, adoption, writes, stranded commits, conflicts, lost races, the pull, serialization, reads, and one-shot writes.
