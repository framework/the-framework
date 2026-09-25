The rules of the `queue` skill [1] and the library behind them: which lines of `TODO_AGENTS.md`, the agent queue [2] on the `agent-data` branch [3], are open work and in what order, where an entry lands and how it leaves, how the framework's add lands, and how the `queue` command an agent [4] runs reaches the file. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: one list of what agents [4] will work on next, in priority sections, that the user edits by hand or from the dashboard, that any agent on any machine reads and extends, and that agents started with `/work-queue` drain from the top; a done task leaves the list, so the list is always the remaining work.

**Business logic story**: three callers use these rules. A long-lived program reads the queue and adds to it through a persistent checkout [5] of the branch and its serialized cycle (`store.ts`). The command (`cli.ts`) runs in an agent's checkout, which holds no copy of the branch: it reads origin's copy and writes through a throwaway checkout of origin's tip, applying the same placement and removal rules (`queue.ts`). The dashboard reads the queue through the same command with `--local` (this machine's copy, no fetch), as the framework's queue provider and from the package's own widget with `--full` (each entry with its section's priority), and the widget queues links through `queue add` (`widget.ts`). The queue does not know tickets: a ticket is queued as a markdown link its caller writes and reads back.

## Glossary

[1] skill: a capability an agent is taught: a package with the instructions the agent reads (its `SKILL.md`) and a command the agent runs through `npx`.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".

## Business logic — TL;DR

- **The queue's name** (`names.ts`) - `TODO_AGENTS.md` at the root of the `agent-data` branch, nameable from browser code too.
- **The queue's rules** (`queue.ts`, `queue.test.ts`) - which lines are open entries, each with the priority of the section it sits in, the file's order as the order of work, placement in a `## Priority N` section or at the end, done as deletion, reading from anywhere in the repository, and an add landing as one commit.
- **The write cycle** (`store.ts`) - the persistent checkout's write cycle every library edit lands through.
- **The `queue` command** (`cli.ts`, `cli.test.ts`) - the bare `queue`, `add` and `done`: JSON out, refusals and exit codes, reads off origin, one pushed commit per write on a throwaway checkout; the dashboard's `--local` (this machine's copy, no fetch) and `--full` (entries with their priorities).
- **The widget's rules** (`widget.ts`, `widget.test.ts`) - how an entry reads on a dashboard, and what "Add to queue" runs for each link a page hands it.
- **The entry point** (`index.ts`) - re-exports what a program uses, `names.ts` also on its own for browser code.
