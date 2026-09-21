The rules of the `tickets` skill [1] and the library behind them: how tickets, plans and claims [2] on the `agent-data` branch [3] are named and gated, read into rows, claimed for one holder [4] at a time and released, kept in sync with origin for a long-lived caller, and reached by the `tickets` command an agent [5] runs. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: one roadmap of markdown tickets that agents [5] on any machine read, claim, plan, work and close, never two on the same ticket, while the user sees each ticket's row in the dashboard and the same files under `tickets` in the project's own checkout.

**Business logic story**: the library offers a long-lived caller a persistent checkout [6] of the branch written through a serialized cycle (`store.ts`) and claims in batches for the agents it starts (`locks.ts`); no program in the repository calls either: the dashboard reads the tickets through the command's `--local` reads and lifts a dead agent's claim through `release --force`, both from the package's own widget (`../dashboard/`). The command (`cli.ts`) runs in an agent's checkout, which holds no copy of the branch: it reads origin's copy and writes through a throwaway checkout of origin's tip, applying the same claim and release rules. The tickets never touch the agent queue [7]: a ticket is queued by its caller as a markdown link, which `names.ts` reads back.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] holder: who a claim names: the agent's id when the program that started the agent set it in `AGENT_ID` (the scheduler does), else the branch the `tickets` command ran on.
[5] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **Where tickets live and which names count** (`names.ts`, `names.test.ts`) - tickets are `.md` files in `tickets/` with `.plan.md` and `.lock.md` siblings; the bare filename and path gates refuse anything that is not a ticket, a queue entry names a ticket only through a link, a ticket's `Priority:` earns its queue section (5 when unreadable), and its `GitHub:` line names the issue it tracks.
- **Reading tickets into rows** (`tickets.ts`, `tickets.test.ts`) - each ticket's title, summary, priority, topics, issue link and date from its head, with its plan's ratings and its claim's holder folded in, newest first, tolerant of tickets predating the format, plus the `meta.json` stamp of the last issue import.
- **Who a claim names** (`holder.ts`, `holder.test.ts`) - `AGENT_ID` when set, else the current branch; a detached checkout names nobody.
- **Claiming and releasing** (`locks.ts`, `locks.test.ts`) - the one-line claim file that never expires, claiming to plan or to implement, batches re-judged rather than double-claimed, releases only by the holder, and a commit that counts even when it could not be pushed.
- **The branch for a long-lived caller** (`store.ts`, `store.test.ts`) - the persistent checkout under `.branches/agent-data`, its write cycle, the `tickets` link at the repository root hidden from git, and the sync with origin.
- **The widget's rules** (`widget.ts`, `widget.test.ts`) - the sentences the widget's pages start agents with, how a page finds the run behind a claim or a plan, how the widget's address reads, a ticket as a link at its priority, and how the command's answers are read back.
- **The `tickets` command** (`cli.ts`, `cli.test.ts`) - `list`, `show`, `put`, `close`, `claim` and `release`: JSON out, refusals and exit codes, reads off origin (or off this machine with `--local`, the dashboard's), `release --force` for a person, one pushed commit per write on a throwaway checkout.
- **The skill's locations** (`bin-dir.ts`) - the executable's directory, the skill's name and the directory holding `SKILL.md`, for a program that starts agents to hand the skill to each one; none in the repository does.
- **The entry point** (`index.ts`) - re-exports everything the product uses, `names.ts` also on its own for browser code.
