The state [1]: one JSON file under `.agent-scheduler/` at the repository root, written by the tool and read by anyone, holding what would otherwise live in a process's memory, so a restart loses nothing. Per user, never tracked: the directory is hidden through the repository's exclude file on the first write, the way `.branches/` is, so no tracked file changes and nothing rides a sweeping `git add -A`.

## Context

**User story**: the user turns the scheduler on and off, picks the model and the spend cushion for their own machine, turns a scheduled command on or off for their own machine with its schedule switch [3], and reads what the last tick [2] decided per command, in one file a dashboard can show as it is; a machine restart, or a crashed scheduler, leaves all of it in place.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[3] schedule switch: a person's choice, on one machine, whether a scheduled command runs there, by the command's name as its schedule line writes it (`triage quick`); kept in the state, not in the schedule (`agent-schedule.md`). The schedule line is the default where nobody switched the command: on, unless the line says `off`.

## Business logic — TL;DR

- **A schedule switch per machine** - a command's schedule switch [3] is kept only where it differs from its schedule line, and switching it back to what the line says removes it; a command nobody switched runs as its line says.
- **A scheduler ending clears only its own pid** - the pid and the start time are removed only when the pid is the ending process's; a pid the next scheduler wrote meanwhile stays.
- **What the state holds** - `on`, `keepAlive`, `model`, `spendOffset`, `switches`, the scheduler's `pid` and `startedAt` while its process runs, and `lastTick`: when, one decision per command (`command`, `outcome`, `run` when one started), the schedule's commands as the tick read them, and a `note` when the tick decided nothing.
- **The defaults** - off, no keep-alive, `opus`, a spend cushion of 100/14 points; a missing file, and a file that does not parse, read as the defaults with nothing else, so a corrupt state never stops a tick.
- **Writing** - every write creates the directory, hides `/.agent-scheduler` through the exclude file (best-effort: a repository whose exclude file cannot be written still has a scheduler), and writes the whole file; an edit is one read, one change, one write.

## Business logic

### What the state holds

#### Context

See `## Context`.

#### Business logic

`on`: whether ticks start agents; off by default, so nothing runs until a person says so. `keepAlive`: whether the scheduler's process outlives whatever started it; written by `start --keep-alive` and read by `stop --unless-keep-alive` only, the line a dashboard runs when it closes. `model`: the model every scheduled run starts on, passed to each run the tick starts; a run started any other way is not given it. `spendOffset`: how far past the spend boundary a run may still start, in percentage points. `switches`: this machine's schedule switch [3] per command, `true` or `false` by the command's name, present only when at least one command is switched away from its line. `pid` and `startedAt`: the scheduler's own process and when it started, present only while `start` has one running. `lastTick`: the last tick's ISO time, its decisions, one per command with the command's name, one outcome line for a person (`started <id>`, `not due`, `not due (last start 2h ago, every 6h)`, `cap reached (…)`, `quota: …`, …) and the run's id when one was started, `schedule`: the schedule's commands as the tick read them, each with its name (`command`), its interval as written (`every`, `1d`) when it has one, its check (`when`) when it has one, and `on`, what its line says rather than this machine's schedule switch, absent when there is no schedule; and a `note` when the tick decided nothing (`off`, `no agent-schedule.md`, `agent-data could not be pulled: …`).

### A schedule switch per machine

#### Context

**User story**: the schedule is tracked, so it is the whole team's default; one person wants the daily clean-up after merges to run on their own machine only, and another wants the queue worked everywhere but on their laptop. Each flips the command's schedule switch [3] on their own machine, from `agent-scheduler switch` or a dashboard's Settings page, and the tracked file never changes.

#### Business logic

Switching a command takes the command's name, the value wanted (on or off) and what its schedule line says. When the value wanted is what the line says, the command's entry is removed from `switches`; otherwise the entry is set to the value wanted. A `switches` left empty is removed from the state. So a command switched back to its line leaves no trace, and a line changed later in the tracked file is the default again on every machine that never switched that command. Whether a command runs on this machine is its entry in `switches` when it has one, else what its line says.

### A scheduler ending clears only its own pid

#### Context

**Problem**: a dashboard's close hook stops the scheduler and its open hook starts the next one; the first still finishes its tick in flight, and its final write of the state came after the next one's pid was written, wiping it: `status` then said no scheduler ran while one ticked, `stop` could not stop it, and the next `start` spawned a second one.

#### Business logic

Removing a scheduler's process from the state takes the process's pid: when the state names that pid, the pid and the start time are removed; when it names another, or none, the state is unchanged.

### The defaults

#### Context

**Problem**: the file may not exist yet, or a person may have edited it by hand into something that does not parse; neither may stop the scheduler.

#### Business logic

With no state file, the state is the default: off, no keep-alive, `opus`, a spend cushion of 100/14 points, no pid, no last tick. A file that parses is read with the defaults filled in for whatever it does not name, so `{"on": true}` reads as the default state turned on. A file that does not parse reads as the default state.

### Writing

#### Context

See `## Context`.

#### Business logic

A write makes `.agent-scheduler/` if missing, adds `/.agent-scheduler` to the repository's exclude file if not there (a failure to do so is ignored), and writes the whole state as indented JSON. `git status` shows nothing of it. An edit of the state is one read, one change applied to what was read, one write, and answers the state as written.
