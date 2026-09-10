The instructions every agent [1] reads before touching the agent queue [2]: where the queue lives, how to read it and change it with the `queue` command, and its format, so that every agent takes work in the same order and leaves the queue as the remaining work. Linked into the agent's checkout [3] where the coding agent's harness looks for skills, it is what turns the command into a skill [4].

## Context

**User story**: an agent starting its backlog work reads what agents will work next, takes the first entry, queues a task it discovered at the right priority, and removes the entry it finished, so the user's queue in the dashboard is always the work that remains, in the order it will be done.

**Business logic story**: everything the skill says the command does is enforced by the rules in `src/cli.ts` and `src/queue.ts`; the daemon drains the queue by the same order with code of its own.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] queue entry: an item on the agent queue.

## Business logic — TL;DR

- **Where the queue is and how to reach it** - `TODO_AGENTS.md` lives on the `agent-data` branch, never on a code branch, and not in the agent's checkout; the agent installs the repository's dependencies if needed and runs `npx queue`, whose every change is one commit pushed straight to the branch.
- **Reading** - the bare `npx queue` gives the open entries, in order of work, as one JSON array.
- **Changing** - `npx queue add <text> [--priority N]` puts an entry in the section of its priority (0 to 10), or at the end of the file without one; `npx queue done <entry>` removes an entry passed exactly as printed, because done means deleted.
- **The format and the order of work** - `## Priority 10` down to `## Priority 0` sections of list items, links or self-contained descriptions; all work agents will do next, sorted by priority, 10 reserved for the critical, first within a section first.

## Business logic

### Where the queue is and how to reach it

#### Context

See `## Context`.

#### Business logic

The agent is told that the agent queue [2], `TODO_AGENTS.md`, lives on the branch `agent-data` [5], never on a code branch, so its own checkout [3] does not contain it, and that the file lists every task agents will work on next, in the order they will be taken. It reads and changes the queue with the `queue` command, a dependency of the repository (`@gemstack/skill-queue`): with no `node_modules` it first installs with the lockfile's package manager (`npm install` for `package-lock.json`), then runs `npx queue`. It is told that every change the command makes is one commit pushed straight to the `agent-data` branch, that a refusal exits 1 with a line on stderr, and that a wrong command line exits 2 with the usage.

### Reading

#### Context

See `## Context`.

#### Business logic

`npx queue` with no command gives the open entries, in order of work, as one JSON array.

### Changing

#### Context

**User story**: the agent queues follow-up work it found, and clears its own entry when the work is merged.

#### Business logic

`npx queue add <text> [--priority N]` puts an entry on the queue: `--priority`, from 0 to 10, places it in that section; without it, the entry goes at the end of the file. `npx queue done <entry>` removes an entry, given as one quoted argument exactly as `npx queue` printed it; done means deleted, never checked off.

### The format and the order of work

#### Context

**User story**: the user and every agent read and write the same file by hand or by command, so the shape of the file is the contract.

#### Business logic

The file is a sequence of sections from `## Priority 10 (critical — act immediately)` down to `## Priority 0 (only if capacity)`, each a markdown list whose items are either a link with a succinct description as its label (`[Succinct description](/link-for-more-details)`) or a self-contained item with a complete description of what should be done. The queue lists all the tasks agents will work on next, sorted by priority. Priority 10 is rarely used, for critical production bugs and the like, and is treated as the utmost priority. Within a priority, the first tasks have higher priority: they are the next tasks within that section. A done queue entry [6] is removed with `npx queue done`.
