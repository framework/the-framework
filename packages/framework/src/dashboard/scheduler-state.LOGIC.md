The scheduler card's read: each project's scheduler [1] as its own state file [2] says it, read by the file's name and shown as it is, plus the one thing only the operating system knows, whether the scheduler's process is alive. The dashboard never runs the scheduler; a project without the file is not set up. The same read gives the usage panel its spend offset [3]: the loosest one any scheduler holds.

## Context

**User story**: the user reads on the Overview whether each project's scheduler is on, whether its process is actually running, which model its runs start on, and what its last tick decided, in the scheduler's own words. The usage panel's handle sits where the schedulers' spend offset [3] is, so the line the bar draws is the line the schedulers obey.

**Business logic story**: the scheduler writes `.agent-scheduler/state.json` at the project's root on every tick; this read is a projection of that file over every registered project, polled by the card and read by the daemon's quota source for the usage panel.

## Glossary

[1] the scheduler: the `agent-scheduler` tool: one small process per project that ticks every minute and starts one agent per due command of the project's `agent-schedule.md`.
[2] the state file: `.agent-scheduler/state.json` at the project's root, written by the scheduler, per user, hidden from git by the scheduler itself.
[3] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.

## Business logic — TL;DR

- **One project's state** - `present` when the file exists and parses as a map; `on` and `keepAlive` as the file says them (anything but `true` is false); `running` when the file names a pid that is a live process on this machine; the model and the spend offset [3] when the file names them; the last tick when it has a time and a list of decisions.
- **Not set up** - a missing, unreadable or unparsable file, or one that is not a map, reads as not present, off, no keep-alive, not running, with no model, no spend offset and no tick; never an error.
- **The last tick** - its time, its decisions (each a command, an outcome line, and the run's id when one started; a decision missing either name is dropped) and its note when there is one; a tick missing its time or its list is left out.
- **Every project** - one row per registered project in registry order, the project's id and name on it; a project whose read fails reads as not set up.
- **The loosest spend offset** - over the states given, the highest spend offset [3] any of them names, since it lets unattended work spend the furthest; none when no state names one.

## Business logic

### One project's state, and not set up

#### Context

See `## Context`.

#### Business logic

The file is read at `<project>/.agent-scheduler/state.json`. When it cannot be read, does not parse as JSON, or is not a JSON object, the project reads as not set up: not present, off, no keep-alive, not running, no model, no spend offset, no last tick. Otherwise the project is present; `on` is true only when the file says `true`, likewise `keepAlive`; `running` is true only when the file names a numeric `pid` and that pid is a live process on this machine (a process that exists under another user counts as alive; the probe is the same the agent store uses); `model` is carried when the file names a string; the spend offset [3] is carried when the file's `spendOffset` is a finite number; the last tick is carried as described next. On with a dead process is reported as it is, since that is the honest state a crashed scheduler leaves.

### The last tick

#### Context

**Problem**: the file is the scheduler's, and a hand-edited or older file may not have the shape the card expects.

#### Business logic

The last tick is carried only when it is an object with a string `at` and a list `decisions`. Each decision is carried when it is an object with a string `command` and a string `outcome`, with its string `run` when present; anything else in the list is dropped. The tick's `note` is carried when it is a string.

### Every project

#### Context

**User story**: the card is one row per project.

#### Business logic

The rows are built over the registered projects as given, in that order, each row the project's id and name plus its state; a read that throws for a project gives that project the not-set-up state rather than failing the whole list.

### The loosest spend offset

#### Context

**User story**: the usage panel draws one line unattended work stops at, and one handle to move it, for all the user's projects at once; the handle writes the same value to every project's scheduler (`../dashboard-rpc/quota.ts`).

#### Business logic

Given the states of the registered projects, the answer is the highest spend offset [3] any of them names: the one that lets unattended work spend the furthest, so the bar never draws a line tighter than what some scheduler obeys. A state that names none, including a project that is not set up, is skipped. When no state names one, there is no answer, and the caller uses its default. The schedulers agree unless one was set by hand.
