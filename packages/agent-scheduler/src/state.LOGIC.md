The state [1]: one JSON file under `.agent-scheduler/` at the repository root, written by the tool and read by anyone, holding what would otherwise live in a process's memory, so a restart loses nothing. Per user, never tracked: the directory is hidden through the repository's exclude file on the first write, the way `.branches/` is, so no tracked file changes and nothing rides a sweeping `git add -A`.

## Context

**User story**: the user turns the scheduler on and off, picks the model and the spend cushion for their own machine, turns a scheduled command on or off for their own machine with its schedule switch [3], sets how often at most a scheduled command starts on their own machine with its pace pick [5], changes how far a scheduled command's runs publish on their own machine with its publish pick [4], and reads what the last tick [2] decided per command, in one file a dashboard can show as it is; a machine restart, or a crashed scheduler, leaves all of it in place.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[3] schedule switch: a person's choice, on one machine, whether a scheduled command runs there, by the command's name (`triage quick`); kept in the state, not in the skill that schedules the command. Every scheduled command is off on a machine until a person switches it on there.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, or one of the publish levels a run may be given (`commit`, `branch`, `pr`, `merge`); kept in the state, not in the skill. It is `commit` until the person picks.
[5] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.

## Business logic — TL;DR

- **A schedule switch per machine** - a command's schedule switch [3] is kept only while the command is switched on, and switching it off removes it; a command nobody switched on does not run on this machine.
- **A pace pick per machine** - a command's pace pick [5] is kept only where a person set one, and taking it back removes it; a command with none runs at its skill's pace.
- **A publish pick per machine** - a command's publish pick [4] is kept once a person set it, and decides how far the command's runs publish on this machine, `nothing` meaning no level; the runs of a command nobody picked for commit their work and push nothing.
- **A scheduler ending clears only its own pid** - the pid and the start time are removed only when the pid is the ending process's; a pid the next scheduler wrote meanwhile stays.
- **What the state holds** - `on`, `keepAlive`, `model`, `spendOffset`, `switches`, `paces`, `publishes`, the scheduler's `pid` and `startedAt` while its process runs, and `lastTick`: when, one decision per command and per skill whose `schedule` key, in its front matter, cannot be read (`command`, `outcome`, `run` when one started), the schedule's commands as the tick read them, each with what its skill says it does, and a `note` when the tick decided nothing per command.
- **The defaults** - off, no keep-alive, `opus`, a spend cushion of 100/14 points; a missing file, and a file that does not parse, read as the defaults with nothing else, so a corrupt state never stops a tick.
- **Writing** - every write creates the directory, hides `/.agent-scheduler` through the exclude file (best-effort: a repository whose exclude file cannot be written still has a scheduler), and writes the whole file; an edit is one read, one change, one write.

## Business logic

### What the state holds

#### Context

See `## Context`.

#### Business logic

`on`: whether ticks start agents; off by default, so nothing runs until a person says so. `keepAlive`: whether the scheduler's process outlives whatever started it; written by `start --keep-alive` and read by `stop --unless-keep-alive` only, the line a dashboard runs when it closes. `model`: the model every scheduled run starts on, passed to each run the tick starts; a run started any other way is not given it. `spendOffset`: how far past the spend boundary a run may still start, in percentage points. `switches`: this machine's schedule switch [3] per command, `true` by the command's name for each command switched on, present only when at least one command is switched on. `paces`: this machine's pace pick [5] per command, by the command's name, present only when at least one command has one: either `{"work": true}`, whenever there is work, or an interval as text (`every`, `2d`), a time of day when it has one (`at`, `10:00`) and the time its time of day counts from (`since`, an ISO time): when the pick was made, or when the command was last switched on with it. `publishes`: this machine's publish pick [4] per command, `nothing`, `commit`, `branch`, `pr` or `merge` by the command's name, present only when at least one command has a pick. `pid` and `startedAt`: the scheduler's own process and when it started, present only while `start` has one running. `lastTick`: the last tick's ISO time, its decisions, one per command with the command's name, and before them one per skill whose `schedule` in its front matter cannot be read, with the skill's name, each with one outcome line for a person (`started <id>`, `not due`, `not due (last start 2h ago, every 6h)`, `cap reached (…)`, `quota: …`, …) and the run's id when one was started, `schedule`: the schedule's commands as the tick read them, each with its name (`command`), its interval as written (`every`, `1d`) when it has one, its check (`when`) when it has one, the plain line saying what its check waits for (`waitsFor`) when its skill gives one, and what its skill says it does, in the skill's own words (`description`), when the skill says, an empty list when no skill of the project schedules a command; this machine's schedule switch, pace pick and publish pick are not in it, so `every` there is always the skill's; and a `note` when the tick decided nothing per command (`off`, `no skill of this project schedules a command`, `agent-data could not be pulled: …`).

### A schedule switch per machine

#### Context

**User story**: every scheduled command starts switched off on every machine, so a skill that arrives in a project starts no agent by itself. One person wants the clean-up after merges to run on their own machine, and another wants the queue worked on their desktop and not on their laptop. Each flips the command's schedule switch [3] on the machine they mean, from `agent-scheduler switch` or a dashboard's Automations page, and no tracked file changes.

#### Business logic

Switching a command takes the command's name and the value wanted, on or off. Switched on, the command's entry in `switches` is set to `true`. Switched off, the command's entry is removed. A `switches` left empty is removed from the state. So a command switched off leaves no trace, and switching off a command nobody switched on changes nothing. A command runs on this machine only when its entry in `switches` is `true`: a command with no entry is off, and in a state file edited by hand an entry of any other value (`"on"`, `false`) is off too.

### A pace pick per machine

#### Context

**User story**: a skill gives its command a starting pace, the same for every machine. One person finds `every: 6h` too often for their laptop and sets every 2 days at 10:00 there; another wants a command to run whenever its check finds work. Each sets the command's pace pick [5] on their own machine, from `agent-scheduler pace` or a dashboard's Automations page, and no tracked file changes. Taking the pick back gives the skill's pace again.

#### Business logic

Setting a command's pace pick takes the command's name and the pick: the command's entry in `paces` is set to it, replacing the one before. Taking a pace pick back takes the command's name alone: the command's entry is removed. A `paces` left empty is removed from the state. So a pace pick taken back leaves no trace, and taking back one nobody set changes nothing. Switching on a command that was off rewrites the `since` of its pace pick when the pick has a time of day (`cli.ts`, by `pace.ts`'s rule); switching it off leaves the pick as it is. This file only keeps the pick: what a pick may hold, which pace is in force for a command and from when the command is due are `pace.ts`'s rules, and a pick that cannot be read there, in a state file edited by hand, counts as none.

### A publish pick per machine

#### Context

**User story**: a skill says nothing about publishing, so how far a scheduled command's runs publish is each person's to pick on their own machine. One person wants the queue's runs on their machine to open a pull request that merges on its own, another wants them to open a pull request and leave the merge to them, and a third wants a routine to publish nothing at all. Each sets the command's publish pick [4] on their own machine, from `agent-scheduler publish` or a dashboard's Automations page, and no tracked file changes. A command nobody picked for commits its work and pushes nothing.

#### Business logic

Setting a command's publish pick takes the command's name and the pick, `nothing`, `commit`, `branch`, `pr` or `merge`: the command's entry in `publishes` is set to it. A pick of `commit` is kept like any other. A pick is never removed: another pick replaces it.

A command's publish pick on this machine is its entry in `publishes` when it has one, else `commit`. An entry that is none of the five picks, in a state file edited by hand, counts as no entry. How far a run of the command publishes on this machine follows from that pick: `commit`, `branch`, `pr` or `merge` is the run's publish level, and `nothing` means the run is given no level and publishes nothing. So a run of a command nobody picked for is given the level `commit`: it commits its work and pushes nothing.

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
