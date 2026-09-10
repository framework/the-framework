The rules of the `tickets` skill [1] and the library behind them: how tickets, plans and claims [2] on the `agent-data` branch [3] are named and gated, read into rows, claimed for one holder [4] at a time and released, kept in sync with origin for the daemon, and reached by the `tickets` command an agent [5] runs. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: one roadmap of markdown tickets that agents [5] on any machine read, claim, plan, work and close, never two on the same ticket, while the user sees each ticket's row in the dashboard and the same files under `tickets` in the project's own checkout.

**Business logic story**: two callers use these rules. The daemon keeps a persistent checkout [6] of the branch and writes through its serialized cycle (`store.ts`), claiming tickets in batches for the agents it starts (`locks.ts`) and importing issues with code of its own. The command (`cli.ts`) runs in an agent's checkout, which holds no copy of the branch: it reads origin's copy and writes through a throwaway checkout of origin's tip, applying the same claim and release rules. The tickets never touch the agent queue [7]: a ticket is queued by its caller as a markdown link, which `names.ts` reads back.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[7] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **Where tickets live and which names count** (`names.ts`, `names.test.ts`) - tickets are `.md` files in `tickets/` with `.plan.md` and `.lock.md` siblings; the bare filename and path gates refuse anything that is not a ticket, a queue entry names a ticket only through a link, a ticket's `Priority:` earns its queue section (5 when unreadable), and its `GitHub:` line names the issue it tracks.
- **Reading tickets into rows** (`tickets.ts`, `tickets.test.ts`) - each ticket's title, summary, priority, topics, GitHub link and date from its head, with its plan's ratings and its claim's holder folded in, newest first, tolerant of tickets predating the format, plus the `meta.json` stamp of the last issue import.
- **Who a claim names** (`holder.ts`, `holder.test.ts`) - `AGENT_ID` when set, else the current branch; a detached checkout names nobody.
- **Claiming and releasing** (`locks.ts`, `locks.test.ts`) - the one-line claim file that never expires, claiming to plan or to implement, batches re-judged rather than double-claimed, releases only by the holder, and a commit that counts even when it could not be pushed.
- **The branch for the daemon** (`store.ts`, `store.test.ts`) - the persistent checkout under `.branches/agent-data`, its write cycle, the `tickets` link at the repository root hidden from git, and the sync with origin.
- **The `tickets` command** (`cli.ts`, `cli.test.ts`) - `list`, `show`, `put`, `close`, `claim` and `release`: JSON out, refusals and exit codes, reads off origin, one pushed commit per write on a throwaway checkout.
- **The skill's locations** (`bin-dir.ts`) - the executable's directory, the skill's name and the directory holding `SKILL.md`, for the daemon to hand the skill to every agent it starts.
- **The entry point** (`index.ts`) - re-exports everything the daemon and the dashboard use, `names.ts` also on its own for browser code.
