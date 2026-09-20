The AI Queue card on the dashboard's Overview: the open entries of the agent queue [1] of every project that has this package, in full, with a way to start an agent on one entry and a way to start several agents on the top of a project's queue at once.

## Context

**User story**: on the Overview the user sees, per project, every task agents will work on next, in order. Beside an entry, one click spins up an agent on that entry alone and lands on the run. Beside a project's name, a count and a fan-out button spin up that many agents, one per entry from the top of the queue, while the user stays on the Overview and the runs appear in the Agents card above. Each start has a "Configure first, then run" that opens the project's launcher with the same prompt instead.

**Business logic story**: the card reads exactly what an agent reads with `npx queue --local`, and every start is the dashboard's own service, given the prompt `src/widget.ts` words for one entry. The card names no other skill: a queued ticket is a link into the repository the card has no page for, so it reads as its title and opens nothing.

## Glossary

[1] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **The read** - `queue --local` in every project that has the package, all projects at once, again every 10 seconds; a project whose command fails is named with the command's reason and the others still show.
- **What shows** - only projects with an open entry (or a failed read), each with its name, its count of open entries, and every entry as its label; "Nothing queued." when no project has one; "Loading…" before the first answer.
- **Starting one entry** - the play button starts one run in the entry's project with the one-entry prompt and the dashboard lands on the run; its chevron opens the launcher with that prompt.
- **The fan-out** - a count beside the project (3 unless changed, never below 1) and a button that starts one run per entry from the top of the queue, as many as the count says, one after another, without leaving the Overview; the batch stops at the first refusal, whose reason shows under the list; its chevron opens the launcher with the top entry's prompt, one agent only.
- **One start at a time** - while a start or a fan-out is in flight every start button on the card waits.

## Business logic

### The read

#### Context

See `## Context`.

#### Business logic

For each project the dashboard lists as having this package, the card asks the dashboard to run `queue --local` in that project: the open entries in order of work, from this machine's copy of the branch with no fetch. Every project is read at once, and again every 10 seconds. A project whose command fails, or prints something that is not a list, shows a red line "Could not read the queue of `<project>`: `<reason>`" under its name; the other projects still show. Until the first read has answered the card says "Loading…".

### What shows

#### Context

See `## Context`.

#### Business logic

A project with no open entry and no failed read is left off the card; when none remains the card says "Nothing queued.". A shown project has a header with its name and the number of its open entries, then every entry, never a "+N more": this is the plan, and a collapsed plan is one you cannot read. An entry reads as `src/widget.ts` labels it: a leading markdown link's text, else the whole entry; a leading link to an absolute http(s) URL opens in a new tab, anything else is plain text; the raw entry shows on hover.

### Starting one entry

#### Context

**User story**: one run on one named entry is a session to watch.

#### Business logic

The play button beside an entry starts one run in the entry's project with the prompt `src/widget.ts` words for that entry (work this one entry, take it off the queue when published, start no other), through the dashboard, which starts it with the user's own picks and lands on the run. A refusal shows in red under the list. The button's chevron, "Configure first, then run", opens the project's launcher with the same prompt drafted in, starting nothing.

### The fan-out

#### Context

**User story**: a project's queue is deep and the user wants several agents on it at once, without landing on any one of them.

**Problem**: several agents told "the first open entry" would all implement the same one.

#### Business logic

Beside a project's count sits a number box, 3 until changed, and the fan-out button. A typed number is rounded and never below 1; an emptied box changes nothing. The button's label says what a click starts, "Spin up an agent working on the top entry" or "Spin up N agents working on the top N entries", with N never above the entries the project has open. A click starts one run per entry from the top of the queue, as many as the count says, one after another, each with that entry's own prompt, each without landing: the Overview stays, and the runs appear in the Agents card. The batch stops at the first refusal, whose reason shows in red under the list. The button's chevron opens the project's launcher with the top entry's prompt alone: a launcher can only ever start one agent.

### One start at a time

#### Context

**Problem**: a start is a sequence of requests, and a second click could slip between two of them.

#### Business logic

While a single start or a fan-out is in flight, every start button on the card waits, and the button that was clicked shows its spinner; the card takes no second start until the first has answered.
