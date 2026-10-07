Builds the data behind the dashboard's cross-project Overview [1] and its shared sidebar: the agents [2] working right now across every project, telling apart the ones another machine's daemon started; the total of open entries on the agent queue [3]; the most recently active projects; the recent agents pooled across projects.

## Context

**User story**: the user opens the dashboard at `/` with no project selected and sees at a glance which agents are working at this moment and on what, how much work waits on the agent queue [3], which projects were touched recently, and, in the sidebar, the latest agents of every project. Selecting a row jumps into that project's agent.

**Problem**: every trace an agent [2] leaves is filed per project, in that project's own files. The Overview [1] rolls those files up across the whole registry, and a project whose files cannot be read must not blank the page, so such a project simply contributes nothing.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. Started from the dashboard by the user, or by the daemon.
[3] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package and read through the command that package declares (`queue.ts`, `../store/queue.ts`). An item on it is a queue entry.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] the record: the `logs` skill's copy of a finished agent's card and diary on the `agent-data` branch, which is the one place a finished agent lives.
[10] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[11] the queued work: one agent started with `/work-queue`, which takes one task off the agent queue by composing the skills in its checkout.

## Business logic — TL;DR

- **Agents working now** - every running agent of every project, one per checkout, most recently updated first, each carrying what was asked and the name of the machine that started it when that is not this one.
- **Web agents whose cloud side is still at work** - a web agent whose local half is over is still listed while its cloud session is working or waiting on a question, once across projects, marked with where it is.
- **Open queue entries, summed** - one number: the open entries of every project's agent queue added up.
- **Recent projects** - the projects with any activity, newest first, at most 5.
- **Recent agents across projects** - every project's agents pooled newest first, at most 30, each agent once even when two projects share its record.

## Business logic

### Agents working now

#### Context

See `## Context`.

#### Business logic

For each project, every live agent [2] whose status is running is listed, one per checkout [4], read from the live record each agent keeps current in its own checkout. A row carries the project, the agent's id, the checkout it edits (so its git and file status is read from the working copy it changes), its status, what the user asked for, and the time of its last event. When the agent's record names the machine whose daemon started it and that machine is not this one, the row carries that machine's name; an agent started here, or whose record names no machine, carries none. The rows are ordered by the time of the last event, newest first. A project whose live agents cannot be read contributes no rows.

### Web agents whose cloud side is still at work

#### Context

**Problem**: an agent whose location [7] is `web` hands its task to a cloud session [8], and from that moment its local half is over: its stored status is done and its checkout may be gone. Read from the live records alone, the Overview [1] would say "no agents working" over a cloud session still coding or parked on a question.

#### Business logic

For each project, every agent [2] of the project is read, the record [9] included, and a web agent is listed when the state of its cloud side is either at work or waiting: waiting when the bridge [10] holds a question its cloud session [8] is parked on; at work when it has no pull request yet and started within the last 12 hours. The rules that turn an agent's record into that state are in `../cloud-run-state.ts`. Such a row is keyed to the project's own path instead of a checkout, and is marked with where the agent is: in its cloud session or waiting on a question. Two projects that are working copies of one repository share their agents' records, so each web agent is listed once, under the first project that lists it. A web agent with a pull request, one started more than 12 hours ago, or one that was stopped or failed is not listed.

### Open queue entries, summed

#### Context

See `## Context`.

#### Business logic

Every project's agent queue [3] is read (the rules are in `queue.ts`; a project with no queue counts nothing) and the open entries of all of them are added into one number.

### Recent projects

#### Context

See `## Context`.

#### Business logic

The projects that have a last-activity time are ordered by it, newest first, and the first 5 are listed with their id, name and that time. A project with no activity at all is left out.

### Recent agents across projects

#### Context

**User story**: with no project selected, the sidebar still shows the latest agents [2], each tagged with its project so selecting one jumps into that project's agent.

#### Business logic

Every project's agents, the record [9] included, are pooled and ordered by their start time, newest first. An agent appears once: two projects that are working copies of one repository share their agents' records, and the first project to list an agent keeps it. At most 30 rows are kept. A project whose agents cannot be read contributes nothing.
