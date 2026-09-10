The rules of the `queue` skill [1] and the library behind them: which lines of `TODO_AGENTS.md`, the agent queue [2] on the `agent-data` branch [3], are open work and in what order, where an entry lands and how it leaves, how the daemon keeps the branch synced, and how the `queue` command an agent [4] runs reaches the file. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: one list of what agents [4] will work on next, in priority sections, that the user edits by hand or from the dashboard, that any agent on any machine reads and extends, and that the daemon drains from the top; a done task leaves the list, so the list is always the remaining work.

**Business logic story**: two callers use these rules. The daemon keeps a persistent checkout [5] of the branch and edits the queue through its serialized cycle (`store.ts`), reading the first open entry fresh before starting an agent on it. The command (`cli.ts`) runs in an agent's checkout, which holds no copy of the branch: it reads origin's copy and writes through a throwaway checkout of origin's tip, applying the same placement and removal rules (`queue.ts`). The queue does not know tickets: a ticket is queued as a markdown link its caller writes and reads back.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".

## Business logic — TL;DR

- **The queue's name** (`names.ts`) - `TODO_AGENTS.md` at the root of the `agent-data` branch, nameable from browser code too.
- **The queue's rules** (`queue.ts`, `queue.test.ts`) - which lines are open entries, the file's order as the order of work, placement in a `## Priority N` section or at the end, done as deletion, reading from anywhere in the repository, and every edit landing as one commit.
- **The branch for the daemon** (`store.ts`, `store.test.ts`) - the persistent checkout's write cycle, an empty queue seeded on a branch born without one, and the sync with origin.
- **The `queue` command** (`cli.ts`, `cli.test.ts`) - the bare `queue`, `add` and `done`: JSON out, refusals and exit codes, reads off origin, one pushed commit per write on a throwaway checkout.
- **The skill's locations** (`bin-dir.ts`) - the executable's directory, the skill's name and the directory holding `SKILL.md`, for the daemon to hand the skill to every agent it starts.
- **The entry point** (`index.ts`) - re-exports everything the daemon and the dashboard use, `names.ts` also on its own for browser code.
