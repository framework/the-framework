The read side of a project's agents [1]. The Framework runs no agent and writes no agent's record: the tool that runs an agent keeps the agent's card and diary [2] in the agent's checkout [3] while it works, and a finished agent is whatever the project's runs provider [4] answers. This file reads both places and composes them into what every dashboard surface lists and replays.

## Context

**User story**:
- The user starts an agent [1] and follows it live; closing the browser tab or restarting the daemon and coming back shows the same agent with the same events and status.
- The Overview lists every agent of a project, working and ended, newest first, including the ones other machines and other people recorded, when the project has a runs provider [4].
- The user answers the question an agent ended on, and the agent stays one row that reads as working again, with its whole history.

**Business logic story**: the dashboard is a projection of files it does not write. An agent's card says who runs it (the process id and the host), so Stop can signal it; an agent whose process died is not repaired here, because the tool that started it sweeps its own dead agents.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] card / diary: an agent's record in two shapes, whose definition is The Framework's (`runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the runs provider [4] answers.
[3] checkout: an agent's own working copy of the project, where it works; the project's branches provider [7] says where it is and which branch it is on. The user's own working copy is "the project's checkout".
[4] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents, in its own package.json under `"framework": { "runs": "<command>" }` (the `logs` skill's package declares its `logs` command).
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its card and diary.
[6] status: how an agent stands: `running`, `done`, `stopped`, `failed`, or `waiting` (it ended on a question, its checkout kept, and the answer resumes it).
[7] branches provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's checkouts, in its own package.json under `"framework": { "branches": "<command>" }` (the `branches` skill's package declares its `branches` command); it lists the checkouts, tells what a branch holds, pushes and opens a branch's pull request, lands one, and reclaims a checkout (`store/branches.ts`).

## Business logic — TL;DR

- **The finished agents** - what the runs provider answers, newest first, each card unfolded into the fields the dashboard reads; optionally only those started since a moment; read fresh when an agent just left its checkout.
- **The agent in a checkout** - a checkout's card read as it stands, whatever its status, with the branch the checkout is on now as the branches provider lists it; nothing is ever repaired on read.
- **Every agent that has a checkout** - each checkout the branches provider lists, newest first; a checkout with no card is skipped; a project with no provider has none.
- **All agents, and one by id** - the ones with a checkout first, then the finished ones; an agent in both is listed once, from its checkout.
- **One agent's events for replay** - the diary in the agent's checkout while it has one, else the finished agent's diary, each line turned into the event the dashboard draws.
- **A finished agent's diary** - every line, from the runs provider; none for an agent whose record still says `running`.
- **Whether a process is alive** - a process id on this machine is probed without signaling it.

## Business logic

### The finished agents

#### Context

See `## Context`. The answer is the runs provider's (`runs.ts`), turned into the dashboard's shape by `run-record.ts`.

#### Business logic

The finished agents of a project are what its runs provider [4] lists, newest first by agent id [5], which sorts as time. Each card [2] becomes the dashboard's record of the agent: the card's own fields as they are, the fields the running tool filed under the card's `caller` key (the process id, the host, the checkout path and whatever else it recorded) unfolded beside them, and the time of the last update taken as the end time, else the start time. A caller may ask only for agents started at or after a moment. A project with no runs provider, or one whose provider fails, has no finished agents; nothing is thrown.

### The agent in a checkout

#### Context

**Problem**: an agent that is working is not finished yet, or is finished only as its first leg; its current state is in its checkout. And the agent renames its branch itself while it works, while its card learns the new name only when the agent ends.

#### Business logic

The agent a checkout [3] holds is read off the card `<agent id>.json` under the checkout's `.the-framework/`, the checkout and the agent id [5] being what the branches provider [7] listed. The card is read as it stands, `running` or not: an agent that ended `waiting` [6] keeps its checkout and is read the same way. The branch is the exception: it is the branch the provider lists the checkout on right now; a checkout the provider lists on no branch keeps the card's branch. A checkout with no card, and a card that does not parse, are no agent. A read never writes: an agent whose card says `running` while its process is gone stays as it is, since the tool that started it sweeps its own.

### Every agent that has a checkout

#### Context

See `## Context`.

#### Business logic

Every checkout the project's branches provider [7] lists is read as above, each agent reported together with the path of its checkout, newest first. A project with no provider, or whose provider cannot be read, has no agent with a checkout; a checkout that cannot be read is skipped rather than failing the list. The provider's list is shared for five seconds (`branches.ts`), so a checkout that just appeared is seen within that time, or at once where a caller asks fresh (`agent-checkout.ts`, and the daemon after a Start).

### All agents, and one by id

#### Context

**Problem**: an agent the user continued has a record from its first leg and is working again in its checkout; the record alone would show a working agent as ended. And an agent that just finished leaves its checkout a moment after it is recorded: a list of finished agents read a few seconds earlier would not have it, and its row would blink out.

#### Business logic

A project's agents are the ones that have a checkout followed by the finished ones; an agent present in both is listed once, as its checkout's card says, plus the record's pull request when the card has none (the dashboard's Open PR writes it on the record, never on a card). Either side that cannot be read contributes nothing. When an agent that had a checkout at the project's previous read has none now, the finished agents are read fresh rather than reused (`runs.ts` shares reads for five seconds). Finding one agent by its id applies the same rule to a single row.

### One agent's events for replay

#### Context

**User story**: the user opens an agent's page and sees everything it said, whether it is working, waiting or long ended.

#### Business logic

An unsafe agent id has no events. When the agent has a checkout and its diary [2] `<agent id>.jsonl` is there, that diary is read, since it is the newer of the two; a trailing line torn by a write in flight is dropped. Otherwise the finished agent's diary is read from the runs provider [4] (below). Each diary line is turned into the event the dashboard draws (`run-record.ts`): what the agent said, its actions, its cost, a question a turn ended on, and its end, which says `waiting` when it ended on a question. An agent in neither place has no events.

### A finished agent's diary

#### Context

See `## Context`; the live feed uses this to follow an agent's diary once its checkout is gone (`agent-checkout.ts`).

#### Business logic

For a safe agent id the runs provider [4] is asked for the agent with its whole diary; the answer is every line, in order. There is none for an unsafe id, a project with no provider, an agent the provider does not have, and an agent whose record still says `running`: the tool that runs an agent may record it as it starts, before its checkout exists, and that agent's diary is still to come in the checkout.

### Whether a process is alive

#### Context

**User story**: Stop must not signal a process that is gone, and a message must reach an agent that is really working.

#### Business logic

A process id is probed with a signal that delivers nothing: a process that is gone reads as dead, and one that exists under another user reads as alive. A process id recorded on another machine cannot be probed from here, so callers compare the card's host with this machine's before trusting the answer. A process id that was reused by another program reads as alive, an accepted rare miss.
