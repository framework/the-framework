The state [1]: one JSON file under `.agent-scheduler/` at the repository root, written by the tool and read by anyone, holding what would otherwise live in a process's memory, so a restart loses nothing. Per user, never tracked: the directory is hidden through the repository's exclude file on the first write, the way `.branches/` is, so no tracked file changes and nothing rides a sweeping `git add -A`. The same directory also holds the automations kept on this machine [8], which are files of their own and no part of the state (`automation.ts`).

## Context

**User story**: the user turns the scheduler on and off, picks the model and the spend cushion for their own machine, turns a scheduled command on or off for their own machine with its schedule switch [3], sets how often at most a scheduled command starts on their own machine with its pace pick [5], sets how many agents may work on a scheduled command at once with its agents pick [6], changes how far a scheduled command's runs publish on their own machine with its publish pick [4], and reads what the last tick [2] decided per command, in one file a dashboard can show as it is; a machine restart, or a crashed scheduler, leaves all of it in place.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[3] schedule switch: a person's choice, on one machine, whether a scheduled command runs there, by the command's name (`triage quick`); kept in the state, not in the skill that schedules the command. Every scheduled command is off on a machine until a person switches it on there. A switch that is on holds the time it was switched on.
[4] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, or one of the publish levels a run may be given (`commit`, `branch`, `pr`, `merge`); kept in the state, not in the skill. It is `commit` until the person picks.
[5] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[6] agents pick: a person's choice, on one machine, of that machine's number for one scheduled command: the machine starts another run of the command only while fewer than that number are in flight on any machine that shares the repository. A whole number from 1 to 99; kept in the state, not in the skill. A command with no agents pick has its skill's number.
[7] cap: how many runs of one scheduled command a machine lets be in flight at once: the machine starts another run of the command only while fewer than its number are in flight on any machine that shares the repository. Its number is the agents pick [6] made on it, a person's own number for the command there, else the number the command's skill gives, 1 when the skill gives none.
[8] automation: a person's own prompt saved as a scheduled command, with the `schedule` the person picked (the key where a skill says when its command is due), an interval, a check (a shell line whose output says whether the command is due) or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.

## Business logic — TL;DR

- **A schedule switch per machine** - a command's schedule switch [3] is kept only while the command is switched on, as the time it was switched on, and switching it off removes it; a command nobody switched on does not run on this machine, and neither does one whose switch holds anything but a time.
- **A pace pick per machine** - a command's pace pick [5] is kept only where a person set one, and taking it back removes it; a command with none runs at its skill's pace.
- **An agents pick per machine** - a command's agents pick [6] is kept only where a person set one, and taking it back removes it; the cap [7] in force is that number, else the skill's.
- **A publish pick per machine** - a command's publish pick [4] is kept once a person set it, and decides how far the command's runs publish on this machine, `nothing` meaning no level; the runs of a command nobody picked for commit their work and push nothing.
- **Nothing left of one command** - a command's schedule switch [3], pace pick [5], agents pick [6] and publish pick [4] taken out of the state together, by the command's name; what a command saved anew under a name starts from on this machine (`agent-scheduler add`), and what goes with an automation [8] that is removed (`agent-scheduler remove`); a state that holds nothing under the name is answered as it is, so nothing is written for it.
- **A command off the last tick's record** - a command's name taken out of the last tick's [2] record, out of the schedule it read and out of what it decided, for an automation [8] removed since that tick, or while that tick ran, so whoever lists the record's commands stops listing it at once; nothing else of the state changes, and a state whose record names no such command is answered as it is.
- **What an automation kept on this machine was given goes with it** - the names whose switch and picks are taken out before a tick: an automation kept on this machine [8] that the last tick listed and whose file is gone, removed or renamed, and a name a skill of the project and such an automation both have; an automation whose file is still there keeps what it was given, also while a slip in the file keeps it off the list; under such a name everything goes, the entries of the command of that name and of every command that is that name and a word; a skill that is gone keeps what it was given.
- **A scheduler ending clears only its own pid** - the pid and the start time are removed only when the pid is the ending process's; a pid the next scheduler wrote meanwhile stays.
- **What the state holds** - `on`, `keepAlive`, `model`, `spendOffset`, `switches`, `paces`, `agents`, `publishes`, the scheduler's `pid` and `startedAt` while its process runs, and `lastTick`: when, one decision per command, per skill whose `schedule` key, in its front matter, cannot be read and per automation kept on this machine [8] that is not listed (`command`, `outcome`, `run` when one started), the schedule's commands as the tick read them, each with what its skill says it does, its skill's number of agents at once when that is more than one, `onThisMachine` when it is an automation kept on this machine [8] and `editable` when it is an automation [8] whose file reads as the tool writes one, and a `note` when the tick decided nothing per command.
- **The defaults** - off, no keep-alive, `opus`, a spend cushion of 100/14 points; a missing file, and a file that does not parse, read as the defaults with nothing else, so a corrupt state never stops a tick.
- **Writing** - every write creates the directory, hides `/.agent-scheduler` through the exclude file (best-effort: a repository whose exclude file cannot be written still has a scheduler), and writes the whole file; an edit is one read, one change, one write.

## Business logic

### What the state holds

#### Context

See `## Context`.

#### Business logic

`on`: whether ticks start agents; off by default, so nothing runs until a person says so. `keepAlive`: whether the scheduler's process outlives whatever started it; written by `start --keep-alive` and read by `stop --unless-keep-alive` only, the line a dashboard runs when it closes. `model`: the model every scheduled run starts on, passed to each run the tick starts; a run started any other way is not given it. `spendOffset`: how far past the spend boundary a run may still start, in percentage points. `switches`: this machine's schedule switch [3] per command, the time the command was switched on (an ISO time, `2026-10-09T07:00:00.000Z`) by the command's name for each command switched on, present only when at least one command is switched on. `paces`: this machine's pace pick [5] per command, by the command's name, present only when at least one command has one: either `{"work": true}`, whenever there is work, or an interval as text (`every`, `2d`), a time of day when it has one (`at`, `10:00`) and the time its time of day counts from (`since`, an ISO time): when the pick was made, or when the command was last switched on with it. `agents`: this machine's agents pick [6] per command, a whole number from 1 to 99 by the command's name, present only when at least one command has one. `publishes`: this machine's publish pick [4] per command, `nothing`, `commit`, `branch`, `pr` or `merge` by the command's name, present only when at least one command has a pick. `pid` and `startedAt`: the scheduler's own process and when it started, present only while `start` has one running. `lastTick`: the last tick's ISO time, its decisions, one per command with the command's name, and before them one per skill whose `schedule` in its front matter cannot be read, with the skill's name, and one per automation kept on this machine [8] that is not listed, with the automation's name (`unlisted automation: …`), each with one outcome line for a person (`started <id>`, `not due`, `not due (last start 2h ago, every 6h)`, `cap reached (…)`, `quota: …`, …) and the run's id when one was started, `schedule`: the schedule's commands as the tick read them, each with its name (`command`), its interval as written (`every`, `1d`) when it has one, its check (`when`) when it has one, the plain line saying what its check waits for (`waitsFor`) when its skill gives one, what its skill says it does, in the skill's own words (`description`), when the skill says, the number of agents at once its skill gives (`agents`) when that is more than one, `onThisMachine: true` when the command is an automation kept on this machine [8] and no skill's, and `editable: true` when the command is an automation [8], shared or kept on this machine, whose file reads as the tool writes one, so `agent-scheduler show`, `edit` and `remove` take it (`schedule.ts`), an empty list when the project has no scheduled command; this machine's schedule switch, pace pick, agents pick and publish pick are not in it, so `every` and `agents` there are always the skill's; and a `note` when the tick decided nothing per command (`off`, `no skill of this project schedules a command`, `agent-data could not be pulled: …`).

### A schedule switch per machine

#### Context

**User story**: every scheduled command starts switched off on every machine, so a skill that arrives in a project starts no agent by itself. One person wants the clean-up after merges to run on their own machine, and another wants the queue worked on their desktop and not on their laptop. Each flips the command's schedule switch [3] on the machine they mean, from `agent-scheduler switch` or a dashboard's Automations page, and no tracked file changes.

**Problem**: a command's check may ask what is new since the command last started, the time it reads as `$LAST_RUN` (`tick.ts`). A command that never started has no last start, and "since the beginning of time" would hand its first run everything that ever came in. And a command that was off on this machine for a month must not, switched on again, start a run for what came in while it was off. So the switch keeps when it was switched on: the check asks what is new since then, until the command starts after that.

#### Business logic

Switching a command takes the command's name and either the time it is switched on at, or no time, which switches it off. Switched on, the command's entry in `switches` is set to that time, replacing the one before; keeping the time of a command that is already on is the caller's (`cli.ts`). Switched off, the command's entry is removed. A `switches` left empty is removed from the state. So a command switched off leaves no trace, and switching off a command nobody switched on changes nothing.

When a command was switched on on this machine is the time its entry in `switches` holds, when that is a time as `names.ts` reads one (an ISO date and time, `2026-10-09T07:00:00.000Z`); a command whose entry is anything else was not switched on. A command runs on this machine only when it was switched on: a command with no entry is off, and in a state file edited by hand an entry of any other value (`"on"`, `true`, `false`, and text a date would read loosely, `"1"`, `"2026"`, `"October 9"`) is off too.

### A pace pick per machine

#### Context

**User story**: a skill gives its command a starting pace, the same for every machine. One person finds `every: 6h` too often for their laptop and sets every 2 days at 10:00 there; another wants a command to run whenever its check finds work. Each sets the command's pace pick [5] on their own machine, from `agent-scheduler pace` or a dashboard's Automations page, and no tracked file changes. Taking the pick back gives the skill's pace again.

#### Business logic

Setting a command's pace pick takes the command's name and the pick: the command's entry in `paces` is set to it, replacing the one before. Taking a pace pick back takes the command's name alone: the command's entry is removed. A `paces` left empty is removed from the state. So a pace pick taken back leaves no trace, and taking back one nobody set changes nothing. Switching on a command that was off rewrites the `since` of its pace pick when the pick has a time of day (`cli.ts`, by `pace.ts`'s rule); switching it off leaves the pick as it is. This file only keeps the pick: what a pick may hold, which pace is in force for a command and from when the command is due are `pace.ts`'s rules, and a pick that cannot be read there, in a state file edited by hand, counts as none.

### An agents pick per machine

#### Context

**User story**: a skill says how many agents may run its command at once, one when it says nothing, the same for every machine. One person wants three agents working the queue at once and sets 3 on their machine; another wants a command whose skill allows four to take one agent at a time and sets 1. Each sets the command's agents pick [6] on their own machine, from `agent-scheduler agents` or a dashboard's Automations page, and no tracked file changes. Taking the pick back gives the skill's number again.

**Problem**: the runs in flight are counted across every machine that shares the repository, and each machine holds them against its own number. So a number is not a share of the work: a machine with 1 starts a run only while no run of the command is in flight anywhere, and a machine with 3 starts one while fewer than three are. Where machines hold different numbers, no more run at once than the largest number among the machines whose scheduler is on with the command switched on. That is a ceiling, not a count: a run still starts only when the command is due.

#### Business logic

Setting a command's agents pick takes the command's name and a number: the command's entry in `agents` is set to it, replacing the one before. A number of 1 is kept like any other, also where the skill says 1. Taking an agents pick back takes the command's name alone: the command's entry is removed. An `agents` left empty is removed from the state. So an agents pick taken back leaves no trace, and taking back one nobody set changes nothing.

The cap [7] in force for a command on this machine is its entry in `agents` when that is a whole number from 1 to 99 (`names.ts`), else the number the command's skill gives. An entry that is no such number, in a state file edited by hand (0, a negative number, a fraction, 100, text), counts as no entry. The number may be above the skill's or below it. It is held against the command's runs in flight on every machine (`tick.ts`).

### A publish pick per machine

#### Context

**User story**: a skill says nothing about publishing, so how far a scheduled command's runs publish is each person's to pick on their own machine. One person wants the queue's runs on their machine to open a pull request that merges on its own, another wants them to open a pull request and leave the merge to them, and a third wants a routine to publish nothing at all. Each sets the command's publish pick [4] on their own machine, from `agent-scheduler publish` or a dashboard's Automations page, and no tracked file changes. A command nobody picked for commits its work and pushes nothing.

#### Business logic

Setting a command's publish pick takes the command's name and the pick, `nothing`, `commit`, `branch`, `pr` or `merge`: the command's entry in `publishes` is set to it. A pick of `commit` is kept like any other. A pick is never removed: another pick replaces it.

A command's publish pick on this machine is its entry in `publishes` when it has one, else `commit`. An entry that is none of the five picks, in a state file edited by hand, counts as no entry. How far a run of the command publishes on this machine follows from that pick: `commit`, `branch`, `pr` or `merge` is the run's publish level, and `nothing` means the run is given no level and publishes nothing. So a run of a command nobody picked for is given the level `commit`: it commits its work and pushes nothing.

### Nothing left of one command

#### Context

**User story**: a person deletes a skill whose command they had switched on, and later saves an automation [8] under the same name. The new command is another prompt, and they never switched it on.

**Problem**: the state keeps a command's schedule switch [3] and picks by the command's name, and keeps them when the skill is gone. A switch left on for a command that is gone would start a new command of that name unasked, at the old one's pace and publishing as far as the old one did.

#### Business logic

Given a command's name, the state is answered with nothing of that command left: its entry is taken out of `switches`, `paces`, `agents` and `publishes`, each only where it has one, and a list left empty is dropped from the state, as when a pick is taken back. Every other command's entries, and everything else in the state, stay as they are. For a name the state holds nothing under, the answer is the very same state, not a copy of it, so a caller can tell that there is nothing to write. `agent-scheduler add` (`cli.ts`) applies it after it saved an automation, and writes the state only when the answer is another state: a save of a dashboard's own may be writing the state at that moment, and a new name needs no write. So the command starts switched off on this machine, at its skill's pace, with its skill's number of agents, its runs committing their work and pushing nothing. `agent-scheduler remove` (`cli.ts`) applies it too, after it deleted an automation's file: what this machine held for the command goes with the command, so a command saved under that name later starts from nothing as well.

### A command off the last tick's record

#### Context

**User story**: a person presses "Remove" on an automation [8] on the dashboard's Automations page. The row is gone when the page next reads the state, not a minute later.

**Problem**: a dashboard lists the commands of the last tick's [2] record, not the files on disk. A command whose file was deleted since that tick would stay listed, with its switch and its buttons, until the next tick records the schedule again: up to a minute where the scheduler runs, and for as long as the scheduler does not run where it is off.

#### Business logic

Given a command's name, the state is answered with that command off the last tick's record: taken out of `lastTick.schedule`, the schedule's commands as the tick read them, and out of `lastTick.decisions`, every decision written under that name, a line saying an automation of that name is not listed (`unlisted automation: …`) included. The record's time and its note stay, and so do every other command's entries and everything else in the state: the switches and the picks are not touched here ("Nothing left of one command", above, takes those). When the state has no last tick, or its record names the command neither in its schedule nor in its decisions, the answer is the very same state, not a copy of it, so a caller can tell that there is nothing to write. `agent-scheduler remove` (`cli.ts`) applies it together with "Nothing left of one command", and writes the state only when the answer is another state. A tick of the real project (`scheduler.ts`) applies it too, when it writes its record: a command whose file went while the tick ran, removed by its person meanwhile, is taken off the record the tick just made, so the record never puts back a command that is gone.

### What an automation kept on this machine was given goes with it

#### Context

**User story**: a person kept an automation on this machine [8], `tidy`: switched on, five agents at once, its runs set to merge on their own. They delete its file. Weeks later a teammate adds a skill `tidy` to the project. Like any skill that arrives, it starts no agent on this machine before the person switches it on.

**Problem**: the state keeps a command's schedule switch [3] and picks by the command's name. A skill's are left when the skill is gone, on purpose: the skill may come back, and a person can always take them back by hand (`cli.ts`). An automation kept on this machine is different: its name is free for anything once its file is gone, and a switch left under the name would start whatever takes the name next, at the automation's pace and publishing as far as it did. The same holds while a skill of the project and an automation kept on this machine have one name (`schedule.ts`): neither is listed, and the switch given to the one must not be waiting for the other.

#### Business logic

Two rules, which a tick of the real project applies before it decides anything (`scheduler.ts`).

The names given up are worked out from the last tick's record and the schedule just read. They are every command the last tick listed as an automation kept on this machine (`onThisMachine`) whose file is gone: the schedule just read neither lists an automation kept on this machine under that name nor names one as not listed. So a file that was removed or renamed gives its name up, also when a skill of the project has the name now. An automation whose file is still there keeps what it was given, also while a slip in the file keeps it off the list (`schedule.ts`: a `schedule` that cannot be read, no text, too long a text): its switch and its picks wait for the fix. A skill of that name whose own `schedule` cannot be read does not stand in for the file: the name is given up. And they are every name the schedule notes as a clash: a name a skill of the project and an automation kept on this machine both have. Each name is given up once. With no last tick, only the clashes are given up. A skill's command that is gone gives nothing up.

Given a name, the state is answered with nothing left under it: in `switches`, `paces`, `agents` and `publishes`, the entry of the command of that name and of every command that is that name followed by a word (`triage`, `triage quick` and `triage consensual` for the name `triage`; not `triage-all`), a list left empty dropped from the state. A publish pick, which a person can only replace with another, goes too. For a name the state holds nothing under, the answer is the very same state. A tick of the real project applies this second rule once more when it writes its record (`scheduler.ts`), for an automation kept on this machine whose file went while the tick ran: the command is taken off the record ("A command off the last tick's record", above), so the next tick would not know it had been listed, and could not give the name up then.

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
