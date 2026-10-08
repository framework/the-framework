One tick [1]: pull the `agent-data` branch [2], sweep [3], read the schedule [4], and for each command [5] decide in the cheapest order (can the coding agent run it, is it switched on on this machine, is it due by its pace [15], does its check say due, is the cap [6] in force reached, can the coding agent start at all, is there quota [7]) then mark and spawn one run [8]. Every decision is one line in the state [9], so a dashboard or a person reads why nothing started without a log; the tick also records the schedule's commands as it read them, so a dashboard can list them without reading the project's skills itself. Whether the coding agent can start, and then the quota, are each read once per tick and only when everything else says start: each read spawns the coding agent's CLI, and the agent's own usage fetch is refused upstream when asked too often. Two machines can tick the same schedule: each marks before it spawns, then counts again, and a marker that landed past the cap in force on the machine that wrote it is withdrawn by that machine.

## Context

**User story**: every minute the user's scheduler looks at the schedule; when the queue holds work and nothing is running it, one agent starts; the user reads in the state, per command, `started <id>`, `not due`, `not due (last start 2h ago, every 6h)`, `not due (next start from 2026-10-10 10:00, every 2d at 10:00)`, `cap reached (1 in flight: <id> on <host>)`, `not ready: …` (Claude Code missing or logged out, with the command that fixes it), `quota: …`, `switched off on this machine` or `not a command of the coding agent: …`; a skill whose `schedule` has a typo shows as `<skill>: unreadable schedule: …` on every tick, also while the scheduler is off, and the other skills' commands still run.

**Business logic story**: this file decides with every reading handed to it (the pull, the sweep, the schedule, the state's schedule switches [12], pace picks [16], agents picks [17] and publish picks [14], the check, the in-flight markers, the coding agent's readiness, the quota, the marker writes, the spawn); `scheduler.ts` wires it to the real project. The marker is `agent-runner`'s, the rule for which command a run counts for `records.ts`'s, the schedule's reading and the due rule `schedule.ts`'s, the pace in force and the time a command is due from `pace.ts`'s, the cap in force `state.ts`'s, the headroom rule `quota-boundary.ts`'s.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died.
[4] the schedule: all the scheduled commands of a project. A skill of the project brings its own with the `schedule` key in the front matter of its `SKILL.md`, called the skill's `schedule`.
[5] command: a scheduled command, one command a skill schedules: the skill's folder name and at most one word the skill takes as its argument (`triage quick`), which the coding agent's harness expands from the slash command `/<name>`; it carries the skills folder its skill was read from; the whole name is what the switch, the pace and the cap go by, and a run record counts for it by its prompt, `/<name>`.
[6] cap: how many runs of one command may be in flight at once, as one machine counts, across every machine's runs. The cap in force on this machine is its agents pick [17] for the command, else the number the command's skill gives, 1 when the skill gives none.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] run: one agent this tool starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[9] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, the model, the spend cushion, this machine's schedule switches [12], pace picks [16], agents picks [17] and publish picks [14], the last tick's decisions.
[10] marker: a run record written before the agent exists: `status: running`, `agent-runner`'s mark, an empty diary.
[11] check: the shell command a skill's `schedule` gives a command as `when`, run at the repository root; its output says whether the command is due.
[12] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[13] publish level: how far a run of a command publishes its work: `commit` (commit the work and push nothing), `branch` (commit it, push the branch and open no pull request), `pr` (commit it, push the branch and open its pull request) or `merge` (commit it, push the branch and open its pull request, set to merge on its own once its checks pass). A scheduled run's level is this machine's publish pick [14] for its command. A run given no level publishes nothing.
[14] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, or one of the publish levels [13] (`commit`, `branch`, `pr`, `merge`); kept in the state, not in the skill. It is `commit` until the person picks.
[15] pace: how often at most a scheduled command starts, the one in force on this machine: this machine's pace pick [16] for the command, else the interval its skill gives; an interval (a count of minutes, hours, days, weeks or months), with a time of day when it has one. A command its check [11] alone paces has no pace.
[16] pace pick: a person's choice, on one machine, of a pace for one scheduled command there: "whenever there is work", or an interval with an optional time of day; kept in the state, not in the skill. A command with no pace pick runs at its skill's pace.
[17] agents pick: a person's choice, on one machine, of how many runs of one scheduled command may be in flight at once, as that machine counts them: a whole number, 1 or more; kept in the state, not in the skill. A command with no agents pick has its skill's number.

## Business logic — TL;DR

- **Before any decision per command** - the branch is pulled; a pull that fails ends the tick with the note `agent-data could not be pulled: <error>`, since a stale branch must start nothing; the sweep runs; a state that is off ends the tick with the note `off`; a schedule with no command and no skill whose `schedule` cannot be read ends it with `no skill of this project schedules a command`.
- **The schedule as read** - every tick record carries the schedule's commands, each with its name, its skill's interval as written, its check, the plain line saying what its check waits for when its skill gives one, what its skill says it does when the skill says, and its skill's number of agents at once when that is more than one; this machine's schedule switches [12], pace picks [16], agents picks [17] and publish picks [14] are not in it.
- **Skills whose `schedule` cannot be read** - each is one decision under the skill's name with `unreadable schedule: <reason>`, on every tick record, whatever its note.
- **Per command, in order** - `not a command of the coding agent: its skill is only under <folder>, not .claude/skills` when the command's skill was not read from `.claude/skills`, and nothing else is read for it; `switched off on this machine` unless this machine's schedule switch [12] for the command is on, and no check runs; for a command with a pace [15], `not due (last start <age> ago, every <interval>)` while the command's last recorded start on any machine is younger than the pace's interval, or `not due (next start from <local time>, every <interval> at <time of day>)` while a pace with a time of day is not due yet, and no check runs; for a command with a check, `check failed: <last line of stderr>` or `not due`; `cap reached (<N> in flight: <id> on <host>, …)` once the runs in flight on every machine reach the cap [6] in force on this machine; `not ready: <problems>`; `quota: <reason>`; `not started: the scheduler was stopped` when a stop came in during the readings; then the marker, the re-count, and `started <id>` or `could not start: <error>`; the marker and the spawned run carry the publish level [13] in force on this machine.
- **Two machines** - a marker whose push was rejected twice is withdrawn: `another machine got there first: <error>`; a marker that landed but ranks past the cap in force on this machine among the in-flight ids in time order is withdrawn: `cap reached (…)` naming the others.
- **The check** - run through `sh -c` at the repository root within its budget; its exit code, stdout and stderr are what the tick reads.
- **The pace** - the pace in force [15] is this machine's pace pick [16], else the skill's interval; it is read before the check, because the run records are on disk while the check spawns a shell; a command never started is past every interval; the age in the line is floored to minutes, hours or days, `less than a minute` under one; a pace with a time of day names the local time the command is next due from.

## Business logic

### Before any decision per command

#### Context

See `## Context`.

#### Business logic

The tick's time is the clock's now. The `agent-data` branch is pulled first; when the pull fails, the tick decides nothing per command and records the note `agent-data could not be pulled: <the pull's error>`. Then the sweep runs, whether or not the state is on. When the state is off, the note is `off` and no command is looked at, no check run. When the state is on and the schedule holds no command and no skill whose `schedule` cannot be read, the note is `no skill of this project schedules a command`.

### The schedule as read

#### Context

**User story**: the Automations page this package brings to a dashboard lists every project's scheduled commands, each with what its skill says it does, when it runs, its schedule switch [12] and its publish pick [14]; the page reads `agent-scheduler status`, not the project's skill files, so it lists what the scheduler's last tick recorded.

#### Business logic

Every tick record, whatever its note (a failed pull, `off`), carries `schedule`: the readable commands of the schedule, in the schedule's order (the skills in name order, a skill's commands in the order its `schedule` writes them), each with the command's name (`command`), its skill's interval as written (`every`, `1d`) when it has one, its check (`when`) when it has one, the plain line saying what its check waits for (`waitsFor`) when its skill gives one, what its skill says it does, in the skill's own words (`description`, the `description` of the skill's front matter as `schedule.ts` read it), when the skill says, and the number of agents at once its skill gives (`agents`) when that is more than one; a command whose skill gives one, or none, has no `agents` there. This machine's schedule switches [12], pace picks [16], agents picks [17] and publish picks [14] are not folded in, so `every` and `agents` are the skill's even where a pace pick or an agents pick stands in for them: the state carries them beside the tick, so a reader has both what the skill says and what this machine chose. A command whose skill is only under `.agents/skills` is in the list like any other, and the list does not say which folder a skill was read from. In a project where no skill schedules a command, `schedule` is an empty list.

### Skills whose `schedule` cannot be read

#### Context

See `schedule.ts`'s unreadable `schedule`.

**Problem**: a skill whose `schedule` cannot be read gives no command, so nothing lists it. A person who has not turned the scheduler on yet, or whose machine cannot reach the remote, must still be told why that skill's commands are missing.

#### Business logic

Every skill whose `schedule` cannot be read is one decision: the command named as the skill, the outcome `unreadable schedule: <the reason>`. These are the first decisions of every tick record, from the start of the tick: they are there when the pull failed, when the state is off, and before the decisions per command. The commands of the other skills are decided as usual. When the state is on and no command is readable at all, these decisions still stand, and the tick has no note.

### Per command, in order

#### Context

**Problem**: the readings cost more as they go: the folder the command's skill was read from, a read of the state, a shell command, a listing of the branch's runs, spawns of the coding agent's CLI; each command stops at the first reading that says no.

#### Business logic

Once the command passed its schedule switch (step 2 below), the pace [15] in force for it is worked out by `pace.ts`'s rule: this machine's pace pick [16] for the command, else the interval its skill gives; none for a command its check alone paces, which a pace pick of "whenever there is work" makes of a command with a check. When the command has a pace, its last start on any machine is read off the run records (the newest start among the records that count for the command, `records.ts`: runs `agent-runner` started whose prompt names the command, whatever became of the run), and `pace.ts` says from when the command is due. While that time is still to come, the command is not due and nothing else is read for it:

- For a pace without a time of day, the outcome is `not due (last start <age> ago, every <interval>)`, the interval being the pace's (`every 1h` where this machine's pace pick is one hour and the skill says `15m`). A command never started is past every interval.
- For a pace with a time of day, the outcome is `not due (next start from <YYYY-MM-DD HH:MM>, every <interval> at <time of day>)`, the time the command is next due from in this machine's local time (`not due (next start from 2026-10-10 10:00, every 2d at 10:00)`). A time that was missed while the scheduler was not running is past, so the command goes on to its check and starts once.

When the command has a check, it runs next. For each command of the schedule, in the schedule's order:
1. The command's skill was read from `.claude/skills`, the folder Claude Code reads a project's skills from, Claude Code being the coding agent every scheduled run is on. Otherwise the outcome is `not a command of the coding agent: its skill is only under <the folder it was read from>, not .claude/skills`, and nothing else is read for the command, not even its schedule switch: typed with a slash, Claude Code would expand the command to nothing.
2. The command is switched on on this machine: its schedule switch [12] in the state is on. Otherwise the outcome is `switched off on this machine`, and neither the pace nor the check is read. A command nobody switched on on this machine is off.
3. The check [11] runs; one that exited non-zero, timed out or could not run gives `check failed: <the last non-empty line of its stderr>`.
4. The check's output says due, by `schedule.ts`'s rule, or the outcome is `not due`.
5. The command's runs in flight, the running records on the branch that count for the command (`records.ts`), on any machine, are counted and held against the cap [6] in force on this machine (`state.ts`): this machine's agents pick [17] for the command, else the number its skill gives. At or past it, the outcome is `cap reached (<count> in flight: <id> on <host>, <id> on <host>)`, each run named by its id and the host that started it (the id alone when the host is unknown).
6. Whether the coding agent can start on this machine is read, once per tick and only now (`agent-runner`'s `readyToRun`); an answer with problems gives `not ready: <the problems, joined by a space>`, nothing is marked and the quota is not read, and every later command of this tick sees the same answer without a second read. Warnings change nothing here.
7. The quota is read, once per tick and only now, and measured against the spend boundary with the state's model and spend cushion; a reading that fails or is not available counts as unknown. No headroom gives `quota: <the headroom rule's reason>`, and every later command of this tick sees the same answer without a second read.
8. The scheduler has not been told to stop while the readings above ran, or the outcome is `not started: the scheduler was stopped`: a stopped scheduler starts nothing, and the readings are where a tick spends its seconds.
9. A run id is minted from the clock, the prompt is `/<command>` (the whole name, `/triage quick`), and a marker [10] is written: a running card with the prompt, the driver's id, the state's model, and `agent-runner`'s mark naming this host and the publish level [13] in force, when there is one: this machine's publish pick [14] for the command, which is `commit` where nobody picked, and no level when the pick is `nothing` (no pid: the run's process does not exist yet; no command: the prompt is what the run counts by).
10. The re-count, below.
11. The run is spawned detached with the id, the prompt, the model and the publish level [13] in force, the one on the marker, which `agent-runner` tells the agent in one sentence after the prompt; a run with no level in force (this machine's publish pick [14] for its command is `nothing`) is given no level and publishes nothing; the outcome is `started <id>` and the decision carries the id as its `run`; a spawn that throws gives `could not start: <the error>`, and the marker stays for the sweep to end on the next tick.

### Two machines

#### Context

**Problem**: two machines' ticks can pass the cap count in the same minute and both write a marker; the branch would then say two runs for a cap of one.

#### Business logic

A marker whose write did not land (the push was rejected, re-applied on origin's new tip, and rejected again) means another machine got there first: the local commit is withdrawn so no record says running for a run that never was, and the outcome is `another machine got there first: <the write's error>`. A marker that landed is ranked: the command's runs in flight are counted again, their ids sorted (ids are start times, so the sort is time order), and the first ids, as many as the cap in force on this machine, are the runs. A marker ranked past that cap is withdrawn by the machine that wrote it, nothing is spawned, and the outcome is `cap reached (<count without it> in flight: …)` naming the others. A marker within the cap keeps its place even when a later one lands too.

Each machine ranks its own marker by its own cap in force, so two machines that hold different numbers for one command can both keep a marker the other's number would not allow. With no run in flight, a machine at 1 and a machine at 3 that mark in the same minute both keep their marker when the first machine's id is the earlier one (it ranks first, the other second of three): two runs start. When the first machine's id is the later one, it ranks second, past its cap of 1, and withdraws. So a machine's number bounds what that machine starts, not what runs: as many runs are in flight as the largest number among the machines that have the command switched on allows.

### The check

#### Context

See `## Context`.

#### Business logic

The check's shell command line runs through `sh -c` with the repository root as the working directory, within the budget the caller gives (one minute in the scheduler's process) and up to four megabytes of output. It is read as its exit status, its stdout and its stderr; a check killed by the budget, or one that could not start, reads as failed with the runtime's message as its stderr when it printed none.
