Maps a run [3] — a card and a diary, in the shape The Framework defines (`runs.ts`) — onto the record and the events the dashboard draws, so every reader of an agent's [4] card and diary — the list of agents, the replay of an ended agent, the live tail of a working one — comes through the one mapping. Reading is the only direction: the tool that runs an agent writes the card and the diary itself, and The Framework records no run of its own.

## Context

**Business logic story**: the card's plain fields and four kinds of diary line are what an agent [4] reads back about earlier runs [3] through the `logs` skill [2]; everything else the program that ran an agent knows about it is its own bookkeeping, kept on the card under one key, `caller`. The Framework reads both halves, from the agent's checkout while it works and from the runs provider once it is finished (`runs.ts`).

## Glossary

[1] status snapshot: an agent's current state as one small object — what was asked, which coding agent [8], the branch, the pull request, the process running it, how it ended — so that reading an agent's status never means replaying its diary. On disk it is the agent's card: `.the-framework/<id>.json` in the agent's checkout while it works, and what the runs provider answers once it has ended (`runs.ts`).
[2] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, a tracked file of the project where the coding agent's harness looks for skills), a command run as `npx <skill>`, and an API the product calls.
[3] run: only the record of one agent: a card (what was asked, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[4] agent: the unit of work: one task worked by a coding agent [8], in its own checkout, on its own branch, keeping a card and a diary, publishing its own work when it ends. Begun by the project's own start hook.
[6] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[7] driver: the coding agent [8] an agent runs on, as its card names it: `claude-code` or `codex` for one begun today; older records also name `github-actions`, `claude-web` and `fake`.
[8] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **From a card** - `caller` is unfolded into the status snapshot, and the card's own fields win over anything of the same name under `caller`.
- **The lines another tool's session writes** - a diary kept by `agent-driver`'s own log (a run `agent-runner` started, from the dashboard's start hook or a scheduler's tick) is read back too: its `start`, `action`, `rate-limit` and `notice` lines become driver events, and so does an `error` line, unless it carries a headline: that one is an agent's own error report from an agent recorded before the daemon stopped running agents, read back as that report (its headline and its detail); its `session` line, the agent's session id alone, becomes a session update; its `question` line becomes the gate the agent view shows, with the id `await-choices`; an `ended` line saying `waiting` becomes an end that says so.
- **The diary: four kinds of line are the skill's** - what the agent said, its result, how it ended and what it cost are read from the skill's four kinds of line; a line of any other kind is an event as written.
- **A line's time is its event's** - a line's `at`, the time it was written, goes onto the event it reads as, whatever its kind; a line with no `at` reads as an event with no time.

## Business logic

### From a card

#### Context

See `## Context`.

#### Business logic

A card carries its own fields (the agent id [6], the start time, the status, and when known the end time, the intent, the driver [7], the model, the branch, the pull request and the cost) and, under its one `caller` key, whatever else the run's writer knows, kept as the writer wrote it. Reading a card unfolds `caller` into the status snapshot [1], and the card's own fields win over anything of the same name found under `caller`. A card whose `caller` carries no last-updated time gets the end time as its last-updated time, or the start time when the run [3] has not ended.

### The diary: four kinds of line are the skill's

#### Context

See `## Context`.

#### Business logic

A `said` line becomes the coding agent's [8] text, a `result` line the turn's final answer, an `ended` line the end event (finished well only when the status is `done`, marked stopped only when it is `stopped`, with its detail), a `cost` line the usage event with the price as its cost. A line of any other kind is an event as written.

### A line's time is its event's

#### Context

**User story**: the agent view shows when each thing happened, the same while the agent [4] works and once it has ended, since both read through this mapping.

#### Business logic

A diary line may carry `at`, the time it was written. The line is read as its event without it, by the rules above, and a text `at` is then put on that event, on every kind of line. A line with no `at`, or with one that is not text, reads as an event with no time.
