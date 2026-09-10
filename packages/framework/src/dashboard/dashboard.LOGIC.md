Builds the data behind the Overview [1], the dashboard's cross-project page: how many projects are registered and how many open entries the agent queues [2] hold in total, the agents [3] working right now (most recently updated first), every registered project ordered most recently active first with whether it has any tickets, and each project's open queue. It is a pure projection of the same files the rest of the dashboard reads, computed on every poll, so it carries only what the page and its onboarding checklist actually display: a project whose state cannot be read contributes nothing, and a ticket read that fails counts as "no tickets".

## Context

**User story**: the user opens the dashboard at `/` and sees at a glance what is going on across every project: who is working now, how much queued work waits, and, for a fresh install, an onboarding checklist that points at the project to act on next.

## Glossary

[1] the Overview: The dashboard's cross-project page at `/`.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] archive: The transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[5] the `agent-data` branch: The branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] tick: One beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **One read of the queues, shared** - the per-project queues are collected once and handed to the "working now" rollup, so the agent queues are read a single time per poll.
- **Totals and the working-now list** - the number of registered projects, the number of open queue entries across them, and the agents going right now, as `overview.ts` rolls them up.
- **Projects most recently active first, with ticket presence** - the onboarding checklist acts on the first project of the list, so the order is an output; each project says whether it has any ticket at all, not how many, and a failed read reads as none.
- **Only what a reader asks for** - the payload has exactly these parts and nothing computed for nobody, since every extra field would cost a walk over every project's whole archive [4] on each poll.

## Business logic

### One read of the queues, shared

#### Context

**Problem**: the "working now" rollup and the page both need the queues, and the page is re-read on a poll; reading every project's agent queue [2] twice per poll would double the cost of the cheapest surface.

#### Business logic

The per-project queues (the rule in `queue.ts`) are collected once, and the "working now" rollup (`overview.ts`) is built from that same collection instead of reading the queues again. The collected queues are also handed to the page as they are.

### Totals and the working-now list

#### Context

See `## Context`.

#### Business logic

The totals are the number of registered projects and the number of open queue entries summed over all projects, as the rollup counts them. The working-now list is the rollup's list of agents [3] currently going, most recently updated first.

### Projects most recently active first, with ticket presence

#### Context

**User story**: the Overview's [1] onboarding checklist tells a new user what to do next and acts on the most recently active project; whether that project has tickets decides what it shows.

#### Business logic

Every registered project appears once, sorted by its last activity, most recent first; a project with no recorded activity sorts last. For each, the page learns only whether the repository has any ticket in `tickets/` on the `agent-data` branch [5] (presence, not a count, by the rule in `tickets.ts`); when that read fails for a project, the project reads as having no tickets rather than failing the page.

### Only what a reader asks for

#### Context

**Problem**: numbers computed for surfaces that no longer exist (per-project agent counts, how past agents ended, a two-week activity window) once cost a walk over every project's whole archive [4] on every poll, twice per tick [6] between the two readers polling it.

#### Business logic

The payload carries exactly four parts: the totals (projects and open queue entries), the working-now list, the project list (each project's id and ticket presence, nothing else), and the queues. Adding a part is a decision, never a leftover.
