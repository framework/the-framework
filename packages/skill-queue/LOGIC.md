The `queue` skill [1]: the agent queue [2], `TODO_AGENTS.md` on the `agent-data` branch [3], the priority-sectioned list of what agents [4] work on next, and the two ways it is reached: the `queue` command an agent runs from its checkout [5] (the bare `queue`, `queue add`, `queue done`, every change one commit pushed straight to the branch) and the library the daemon calls to read the queue fresh, add and remove entries, and keep the branch synced with an empty queue seeded on a new branch. `SKILL.md` is what the agent reads, `DECISIONS.md` records the picks behind these rules, and `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic.

## Context

**User story**: the user keeps one ordered list of what agents [4] will do next, edits it by hand or from the dashboard, and watches it shrink as work is merged; an agent takes the first entry, queues follow-up work at the right priority, and removes what it finished; the daemon drains the same list unattended.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - where the queue lives, the three commands, and the file's format and order of work.
- **The executable** (`bin/`) - the `queue` command on every agent's PATH, handing the shell to the command's rules.
- **The rules and the library** (`src/`) - the queue's name, which lines are entries and where they land, the branch's checkout and sync, and the command itself.
