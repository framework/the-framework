The Overview's [1] "Scheduler" card: every registered project's scheduler [2], a projection of the state file [3] each scheduler writes, re-read every five seconds. One row per project: whether the scheduler is on and its process alive, its model, and what its last tick decided, in the scheduler's own words. A decision that started a run opens that agent [4]. No buttons: the scheduler is started and stopped by the project's own hooks [5] and from the command line, and a button here would make the dashboard name the tool.

## Context

**User story**: the user opens the Overview and reads under "Scheduler" that gemstack's scheduler is on, keeps alive, starts runs on `opus`, ticked a minute ago and found the work queue not due, or started a run, which one click opens.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] the scheduler: the `agent-scheduler` tool: one small process per project that ticks every minute and starts one agent per due command of the project's `agent-schedule.md`.
[3] the state file: `.agent-scheduler/state.json` at the project's root, written by the scheduler, per user.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] hooks: the shell lines a project's own `.the-framework/hooks.yml` names under `open` and `close`, run in the project by the daemon when the dashboard opens and closes.

## Business logic — TL;DR

- **What the card shows** - "Scheduler", "Agents started on a schedule while nobody is at the keyboard, per project", then one row per registered project; "Loading…" until the first read answers, "No projects." when the registry lists none.
- **A row's first line** - the project's name, one status word, a "keep-alive" pill when the scheduler keeps alive, and the model at the right when the file names one.
- **The status word** - "not set up" when the project has no state file, "off" when the file says off, "on, not running" when it says on but the scheduler's process is gone, "on" when on and alive.
- **The last tick** - "last tick <age>" with the exact time as its tooltip, the tick's note after a colon when it decided nothing, then one line per decision as "<command>: <outcome>"; a decision that started a run is a button that opens that agent.

## Business logic

### What the card shows, and a row's first line

#### Context

See `## Context`.

#### Business logic

The card is titled "Scheduler" with the subtitle "Agents started on a schedule while nobody is at the keyboard, per project". Until the first read answers it says "Loading…"; with no registered project it says "No projects."; otherwise every registered project has a row, in the order the read gives them, whether or not it has a scheduler. A row's first line is the project's name, then the status word, then a pill reading "keep-alive" when the file says keep-alive, then, at the right, the model when the file names one. What each field means, and what a missing or broken file reads as, is decided in `src/dashboard/scheduler-state.ts`.

### The status word

#### Context

**Problem**: on in the file and a live process are two facts, and a crashed scheduler is the case where they differ.

#### Business logic

A project without a state file reads "not set up" (muted); a file that says off reads "off" (muted); a file that says on while the scheduler's process is not alive reads "on, not running" (warning colour); on with the process alive reads "on" (success colour).

### The last tick

#### Context

**User story**: the user reads why nothing started ("not due", "cap reached (…)", "quota: …") without opening the file.

#### Business logic

When the file carries a last tick, the row shows "last tick" followed by the tick's age ("2m ago"), whose tooltip is the exact local time; when the tick carries a note (it decided nothing: the schedule is missing, the branch could not be pulled), the note follows after a colon. Under it, one bulleted line per decision, "<command>: <outcome>", the outcome exactly as the scheduler wrote it. A decision that names a run is a button whose click opens that agent (project and run id), since the run's id is the agent's id; a decision that started nothing is plain text.
