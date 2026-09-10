Builds the data behind the dashboard's cross-project Overview [1] and its shared sidebar: the agents [2] working right now across every project, telling apart the ones another machine's daemon started; the total of open entries on the agent queue [3]; the most recently active projects; the recent agents pooled across projects; the "hot tickets" card with its three lanes; and one ticket list per project for the cross-project Tickets page.

## Context

**User story**: the user opens the dashboard at `/` with no project selected and sees at a glance which agents are working at this moment and on what, how much work waits on the agent queue [3], which projects were touched recently, which tickets are hot, and, in the sidebar, the latest agents of every project. Selecting a row jumps into that project's agent.

**Problem**: every trace an agent [2] leaves is filed per project, in that project's own files. The Overview [1] rolls those files up across the whole registry, and a project whose files cannot be read must not blank the page, so such a project simply contributes nothing.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[7] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[10] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[11] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[12] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.

## Business logic — TL;DR

- **Agents working now** - every running agent of every project, one per checkout, most recently updated first, each carrying what was asked, its session name, its ready-for-merge state, and the name of the machine that started it when that is not this one.
- **Web agents whose cloud side is still at work** - a web agent whose local half is over is still listed while its cloud session is working or waiting on a question, once across projects, marked with where it is.
- **Open queue entries, summed** - one number: the open entries of every project's agent queue added up.
- **Recent projects** - the projects with any activity, newest first, at most 5.
- **Recent agents across projects** - every project's agents pooled newest first, at most 30, each agent once even when two projects share its record.
- **Hot tickets** - every project's tickets placed in one of three lanes, in progress, on the agent queue, high priority, in that precedence; everything else is left off; at most 60 pooled, lane order first.
- **Every project's tickets for the Tickets page** - one list per project in registry order, a project kept even with no tickets.

## Business logic

### Agents working now

#### Context

See `## Context`.

#### Business logic

For each project, every live agent [2] whose status is running is listed, one per checkout [4], read from the live record each agent keeps current in its own checkout. A row carries the project, the agent's id, the checkout it edits (so its git and file status is read from the working copy it changes), its status, what the user asked for, the time of its last event, the session name [5] when its branch carries one, and whether it has signaled ready for merge [6]. When the agent's record names the machine whose daemon started it and that machine is not this one, the row carries that machine's name; an agent started here, or whose record names no machine, carries none. The rows are ordered by the time of the last event, newest first. A project whose live agents cannot be read contributes no rows.

### Web agents whose cloud side is still at work

#### Context

**Problem**: an agent whose location [7] is `web` hands its task to a cloud session [8], and from that moment its local half is over: its stored status is done and its checkout may be gone. Read from the live records alone, the Overview [1] would say "no agents working" over a cloud session still coding or parked on a question.

#### Business logic

For each project, every agent [2] of the project is read, archive [9] included, and a web agent is listed when the state of its cloud side is either at work or waiting: waiting when the bridge [10] holds a question its cloud session [8] is parked on; at work when it has no pull request yet and started within the last 12 hours. The rules that turn an agent's record into that state are in `../cloud-run-state.ts`. Such a row is keyed to the project's own path instead of a checkout, and is marked with where the agent is: in its cloud session or waiting on a question. Two projects that are working copies of one repository share their agents' records, so each web agent is listed once, under the first project that lists it. A web agent with a pull request, one started more than 12 hours ago, or one that was stopped or failed is not listed.

### Open queue entries, summed

#### Context

See `## Context`.

#### Business logic

Every project's agent queue [3] is read (the rules are in `queue.ts`) and the open entries of all of them are added into one number.

### Recent projects

#### Context

See `## Context`.

#### Business logic

The projects that have a last-activity time are ordered by it, newest first, and the first 5 are listed with their id, name and that time. A project with no activity at all is left out.

### Recent agents across projects

#### Context

**User story**: with no project selected, the sidebar still shows the latest agents [2], each tagged with its project so selecting one jumps into that project's agent.

#### Business logic

Every project's agents, archive [9] included, are pooled and ordered by their start time, newest first. An agent appears once: two projects that are working copies of one repository share their agents' records, and the first project to list an agent keeps it. At most 30 rows are kept. A project whose agents cannot be read contributes nothing.

### Hot tickets

#### Context

**User story**: the Overview's [1] hot-tickets card is a shortlist, not the whole backlog: what is being worked on right now, what The Framework will pick up on its own, and what a human would likely queue next. A ticket being coded at this moment links to the agent [2] coding it.

**Problem**: a ticket's plan [12] says that someone planned it at some point, not that it is being coded as the user looks. Only an agent's own record tells the two apart, and an agent records the ticket it implements only when the daemon started it on a queue entry (a drain [11]), so tickets worked by hand still count through their plan.

#### Business logic

Every project's tickets are read (`tickets.ts`) and each ticket is placed in the first lane that applies, or left off the card when none does:

- **in progress**: a running agent of the same project recorded this ticket as the one it is implementing, in which case the row carries that agent's id for the card to link into; or, failing that, the ticket has a plan [12]. An agent that has ended is not implementing anything, however recently it stopped.
- **on the agent queue** (the card's "AI Queue" lane): an open entry of the project's agent queue [3] begins with a markdown link, and that link's target is this ticket's file under `tickets/`. A link elsewhere in the entry does not count, and neither does a link to something other than a ticket. A finished entry does not count.
- **high priority**: the ticket's `Priority:` reads 7 or more on the ticket format's 10-to-0 scale, where 10 is critical and 0 is only-if-capacity. Word spellings such as `high`, `urgent`, `p0` or `p1` are not on that scale and never qualify.

A ticket's file name is only unique inside its own repository, so the implementing match is made per project: another project's agent never lights up a same-named ticket. The pooled list is ordered lane first, in progress, then the agent queue, then high priority, with the tickets' own order kept inside a lane, and at most 60 tickets are pooled; the card itself trims each lane further. A project whose tickets or agents cannot be read contributes nothing.

### Every project's tickets for the Tickets page

#### Context

**User story**: the cross-project Tickets page shows each project's whole backlog as its own list, with that project's import and update actions reachable from it, rather than one merged feed.

#### Business logic

One list per project, in registry order, with the project's id and name. A project is kept even when its list is empty, so importing tickets stays reachable there. When a project's tickets cannot be read, its list is simply empty rather than the project being dropped.
