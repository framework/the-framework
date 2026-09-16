The live log [1] of a run [2], temporary: `agent.json` (the meta) and `events.jsonl` (the events) under `.the-framework/` in the run's checkout [3], in the shape The Framework's dashboard reads today, the shape its own run child writes. Written so a scheduled run shows on the dashboard as it goes, until `agent-driver` writes a live log of its own to a path it is given and the dashboard reads that. Nothing in this tool reads these files back except the sweep [4], which needs the pid and the host.

## Context

**User story**: the user opens the dashboard while a scheduled run works and sees it like any other agent: running, on which branch, what it said so far, what it cost; when the run ends, the same lines are its diary on the `agent-data` branch.

**Business logic story**: the run's process (`run.ts`) opens the log when its checkout exists and appends every event; the sweep (`sweep.ts`) reads the meta of every checkout on this machine to find dead runs, and closes a dead run's log from outside its process.

## Glossary

[1] live log: `agent.json` and `events.jsonl` under `.the-framework/` in a run's checkout, in the shape The Framework's dashboard reads: the run's status, pid, host and cost as it goes, and every event.
[2] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died.
[5] the tool's mark: `caller.scheduler` on a card: the command the run was started for, the machine that started it, and the run's process on that machine while it runs.
[6] card: the run record's `<id>.json`: what was asked, the branch, the pull request, how it ended, what it cost.
[7] diary: the run record's `<id>.jsonl`: what the agent said.

## Business logic — TL;DR

- **The meta** - the run's status, id, start and last-update times, pid, host, the prompt as its intent, and, as events arrive, the driver, the checkout, the model, the branch, the session id, the cost and the end; always with the tool's mark, which is how the sweep knows a checkout is this tool's.
- **Opening** - the directory made in the checkout and hidden through the checkout's exclude file, since an untracked directory would keep the checkout dirty and a dirty checkout is never reclaimed; the meta written, the events file empty.
- **Appending** - each event goes on the events file as one line and is folded into the meta: a session names the driver, the workspace and the model; a session update the session id; an intent the prompt; a branch the branch; usage adds to the cost; the end sets `done`, `stopped` when the end says the run was stopped, else `failed`, and the end time. Writes stay in order; a failed write never breaks the run.
- **The events as the diary, the meta as the card** - what the agent said, its result, the run's end and its cost become the `logs` skill's four kinds of diary line; every other event is written as it is, which is how the dashboard replays an archived run. The card takes the skill's fields off the meta and keeps the rest under `caller`, beside the tool's mark.
- **Reading and closing from outside** - a checkout's meta is read only when it is this tool's (it carries the mark); the events are read up to the first line that does not parse; a dead run's end is appended to both files by the sweep, as its own process would have.

## Business logic

### The meta

#### Context

See `## Context`.

#### Business logic

The meta starts as `running`, with the run's id, its start time as the last update, the run's process pid, the host, the prompt as the intent, the kind `prompt`, and the tool's mark [5]. Every appended event updates the last-update time. A `session` event sets the driver, the workspace (the checkout's path) and the model; a `session-update` the session id (the agent's `claude --resume` handle); an `intent` the intent; a `branch` the branch; a `usage` event adds its cost to the running total when it prices the turn; an `end` event sets the status to `done` when ok, to `stopped` when it says the run was stopped (the dashboard's own flag on an end event), and to `failed` otherwise, and the end time. Driver events change nothing in the meta.

### Opening

#### Context

**Problem**: a checkout with an untracked directory in it is a dirty tree, and the `branches` rule never reclaims a dirty tree.

#### Business logic

Opening a run's log makes `.the-framework/` in the checkout, adds `/.the-framework` to the checkout's exclude file (a failure to do so is ignored), writes an empty events file and the meta.

### Appending

#### Context

See `## Context`.

#### Business logic

An event is folded into the meta at once, appended to the events file as one JSON line, and the meta rewritten; writes are queued so they land in order, and a write that fails is dropped without failing the run.

### The events as the diary, the meta as the card

#### Context

**Problem**: the `logs` skill knows four kinds of diary line (what the agent said, its result, the run's end, its cost) and eleven card fields; the dashboard replays whatever else was recorded.

#### Business logic

A driver event that is streamed text becomes a `said` line; a driver result becomes a `result` line with the result's fields; the end becomes an `ended` line with the status (`done`, `stopped` or `failed`, as above) and, when there is one, the detail; a usage event becomes a `cost` line with the price in dollars when known and the token counts and turns; every other event (session, session update, intent, branch, tool use, …) is written as it is. The card [6] is built from the meta: id, start time, status, intent, and, when set, end time, driver, model, branch and cost as the skill's fields; the pull request when the run's process read one back; everything else on the meta (pid, host, kind, workspace, session id, last update) under `caller` beside the tool's mark, which stays `caller.scheduler`.

### Reading and closing from outside

#### Context

See `## Context`.

#### Business logic

A checkout's meta is read as this tool's only when it parses, names an id, and carries the tool's mark; otherwise the checkout is not this tool's and is left alone. The events are read line by line up to the first line that does not parse, a line cut short by a dying process. Closing a log from outside its process appends an `end` event to the events file and rewrites the meta with it folded in, both best-effort, and answers the meta as closed.
