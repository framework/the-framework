The `queue` skill [1]: the agent queue [2], `TODO_AGENTS.md` on the `agent-data` branch [3], the priority-sectioned list of what agents [4] work on next, and the ways it is reached: the `queue` command an agent runs from its checkout [5] (the bare `queue`, `queue add`, `queue done`, every change one commit pushed straight to the branch); the same command read by the product (`packages/framework`) as the project's queue provider, which this package's `package.json` declares (`"framework": { "queue": "queue" }`), with `--local` for this machine's copy of the branch; the package's own widget [6] in the dashboard (`dashboard/`, exported as `./dashboard`), the Queue page and the "Add to queue" action, both through the command; and the library a long-lived program calls to read the queue and add entries. `SKILL.md` is what the agent reads, `DECISIONS.md` records the picks behind these rules, and `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic.

## Context

**User story**: the user keeps one ordered list of what agents [4] will do next, edits it by hand or from the dashboard, and watches it shrink as work is merged; an agent takes the first entry, queues follow-up work at the right priority, and removes what it finished; an agent started with `/work-queue`, by a person or by the scheduler, works the same list unattended.

## Glossary

[1] skill: a capability an agent is taught: a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills) and a command the agent runs through `npx`.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard, offers actions on the links its pages show, and reads and changes its data through its own package's command.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - where the queue lives, the three commands, and the file's format and order of work.
- **The executable** (`bin/`) - the `queue` command on every agent's PATH, handing the shell to the command's rules.
- **The rules and the library** (`src/`) - the queue's name, which lines are entries and where they land, the branch's write cycle, the command itself with the dashboard's `--local` and `--full` reads, and the widget's rules.
- **The dashboard's widget** (`dashboard/`) - the Queue page at `/queue`, every project's open entries by priority section from `queue --local --full`, and "Add to queue" on any link a dashboard page shows, one `queue add` per link.
