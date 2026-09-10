The `tickets` skill [1]: the project's tickets as markdown files under `tickets/` on the `agent-data` branch [2], each with an optional plan and claim [3] beside it, and the two ways they are reached: the `tickets` command an agent [4] runs from its checkout [5] (`list`, `show`, `put`, `close`, `claim`, `release`, every change one commit pushed straight to the branch) and the library the daemon calls to read tickets, claim them for the agents it starts, release them and keep the branch synced, with a `tickets` link at the repository root for the user. `SKILL.md` is what the agent reads, `DECISIONS.md` records the picks behind these rules, and `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic.

## Context

**User story**: the user's roadmap is a folder of markdown tickets any agent [4] can read, claim and close from any machine, no two agents ever working the same ticket; the user sees each ticket's row in the dashboard, queues a ticket at its own priority, and finds the same files under `tickets` in the project's own checkout.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - where the tickets live, the six commands, claiming before planning or working and releasing after, queueing a ticket as a link at its priority, and the ticket, claim and plan formats.
- **The executable** (`bin/`) - the `tickets` command on every agent's PATH, handing the shell to the command's rules.
- **The rules and the library** (`src/`) - the filename gates, the ticket rows, the holder, the claim and release rules, the branch's checkout, sync and root link, and the command itself.
