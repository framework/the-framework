One tick [1]: pull the `agent-data` branch [2], sweep [3], read the schedule [4], and for each command [5] decide in the cheapest order (is it switched on on this machine, has its interval passed, is it due, is its cap [6] reached, can the coding agent start at all, is there quota [7]) then mark and spawn one run [8]. Every decision is one line in the state [9], so a dashboard or a person reads why nothing started without a log; the tick also records the schedule's commands as it read them, so a dashboard can list them without reading the project's skills itself. Whether the coding agent can start, and then the quota, are each read once per tick and only when everything else says start: each read spawns the coding agent's CLI, and the agent's own usage fetch is refused upstream when asked too often. Two machines can tick the same schedule: each marks before it spawns, then counts again, and the marker that landed past the cap is withdrawn by the machine that wrote it.

## Context

**User story**: every minute the user's scheduler looks at the schedule; when the queue holds work and nothing is running it, one agent starts; the user reads in the state, per command, `started <id>`, `not due`, `cap reached (1 in flight: <id> on <host>)`, `not ready: …` (Claude Code missing or logged out, with the command that fixes it), `quota: …` or `switched off on this machine`; a skill whose `schedule` has a typo shows as `<skill>: unreadable schedule: …` while the other skills' commands still run.

**Business logic story**: this file decides with every reading handed to it (the pull, the sweep, the schedule, the state's schedule switches [12] and publish picks [14], the check, the in-flight markers, the coding agent's readiness, the quota, the marker writes, the spawn); `scheduler.ts` wires it to the real project. The marker is `agent-runner`'s, the rule for which command a run counts for `records.ts`'s, the schedule's reading and the due rule `schedule.ts`'s, the headroom rule `quota-boundary.ts`'s.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died.
[4] the schedule: all the scheduled commands of a project. A skill of the project schedules its own with the key `schedule` in the front matter of its `SKILL.md`.
[5] command: a scheduled command, one command a skill schedules: the skill's folder name and at most one word the skill takes as its argument (`triage quick`), which the coding agent's harness expands from the slash command `/<name>`; the whole name is what the switch, the interval and the cap go by, and a run record counts for it by its prompt, `/<name>`.
[6] cap: how many runs of one command may be in flight at once, across every machine that shares the repository.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] run: one agent this tool starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[9] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, the model, the spend cushion, this machine's schedule switches [12] and publish picks [14], the last tick's decisions.
[10] marker: a run record written before the agent exists: `status: running`, `agent-runner`'s mark, an empty diary.
[11] check: the shell command a skill's `schedule` gives a command as `when`, run at the repository root; its output says whether the command is due.
[12] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the state, not in the skill. Every scheduled command is off on a machine until a person switches it on there.
[13] publish level: how far a run of a command publishes its work: `commit` (commit the work and push nothing), `branch` (commit it, push the branch and open no pull request), `pr` (commit it, push the branch and open its pull request) or `merge` (commit it, push the branch and open its pull request, set to merge on its own once its checks pass). A scheduled run's level is this machine's publish pick [14] for its command. A run given no level publishes nothing.
[14] publish pick: a person's choice, on one machine, of how far a scheduled command's runs publish there: `nothing`, or one of the publish levels [13] (`commit`, `branch`, `pr`, `merge`); kept in the state, not in the skill. It is `commit` until the person picks.

## Business logic — TL;DR

- **Before any decision** - the branch is pulled; a pull that fails ends the tick with the note `agent-data could not be pulled: <error>`, since a stale branch must start nothing; the sweep runs; a state that is off ends the tick with the note `off`; a schedule with no command and no unreadable skill ends it with `no skill of this project schedules a command`.
- **The schedule as read** - every tick record carries the schedule's commands, each with its name, its interval as written, its check, and the plain line saying what its check waits for when its skill gives one; this machine's schedule switches [12] and publish picks [14] are not in it.
- **Unreadable schedules** - each skill whose `schedule` cannot be read is one decision under the skill's name with `unreadable schedule: <reason>`.
- **Per command, in order** - `switched off on this machine` unless this machine's schedule switch [12] for the command is on, and no check runs; for a command with an interval, `not due (last start <age> ago, every <interval>)` while the command's last recorded start on any machine is younger than the interval, and no check runs; for a command with a check, `check failed: <last line of stderr>` or `not due`; `cap reached (<N> in flight: <id> on <host>, …)`; `not ready: <problems>`; `quota: <reason>`; `not started: the scheduler was stopped` when a stop came in during the readings; then the marker, the re-count, and `started <id>` or `could not start: <error>`; the marker and the spawned run carry the publish level [13] in force on this machine.
- **Two machines** - a marker whose push was rejected twice is withdrawn: `another machine got there first: <error>`; a marker that landed but ranks past the cap among the in-flight ids in time order is withdrawn: `cap reached (…)` naming the others.
- **The check** - run through `sh -c` at the repository root within its budget; its exit code, stdout and stderr are what the tick reads.
- **The interval** - read before the check, because the run records are on disk while the check spawns a shell; a command never started is past every interval; the age in the line is floored to minutes, hours or days, `less than a minute` under one.

## Business logic

### Before any decision

#### Context

See `## Context`.

#### Business logic

The tick's time is the clock's now. The `agent-data` branch is pulled first; when the pull fails, the tick records no decisions and the note `agent-data could not be pulled: <the pull's error>`. Then the sweep runs, whether or not the state is on. When the state is off, the note is `off` and no command is looked at, no check run. When the state is on and the schedule holds no command and no skill whose `schedule` cannot be read, the note is `no skill of this project schedules a command`.

### The schedule as read

#### Context

**User story**: the Scheduler section this package brings to a dashboard's Settings page lists one schedule switch [12] and one publish menu per scheduled command of every project; the section reads `agent-scheduler status`, not the project's skill files, so it lists what the scheduler's last tick recorded.

#### Business logic

Every tick record, whatever its note (a failed pull, `off`), carries `schedule`: one entry per readable command of the schedule, in the schedule's order (the skills in name order, a skill's commands in the order its `schedule` writes them), with the command's name (`command`), its interval as written (`every`, `1d`) when it has one, its check (`when`) when it has one, and the plain line saying what its check waits for (`waitsFor`) when its skill gives one. This machine's schedule switches [12] and publish picks [14] are not folded in: the state carries them beside the tick, so a reader has both what the skill says and what this machine chose. In a project where no skill schedules a command, `schedule` is an empty list.

### Unreadable schedules

#### Context

See `schedule.ts`'s unreadable schedule.

#### Business logic

Before the commands, every skill whose `schedule` cannot be read is one decision: the command named as the skill, the outcome `unreadable schedule: <the reason>`. The commands of the other skills are decided as usual. When no command is readable at all, these decisions still stand, and the tick has no note.

### Per command, in order

#### Context

**Problem**: the readings cost more as they go: a shell command, a listing of the branch's runs, spawns of the coding agent's CLI; each command stops at the first reading that says no.

#### Business logic

Once the command passed its schedule switch (step 1 below), when the command has an interval, the command's last start on any machine is read off the run records (the newest start among the records that count for the command, `records.ts`: runs `agent-runner` started whose prompt names the command, whatever became of the run); a start younger than the interval decides `not due (last start <age> ago, every <interval>)` and nothing else is read for the command; a command never started is past every interval. When the command has a check, it runs next. For each command of the schedule, in the schedule's order:
1. The command is switched on on this machine: its schedule switch [12] in the state is on. Otherwise the outcome is `switched off on this machine`, and neither the interval nor the check is read. A command nobody switched on on this machine is off.
2. The check [11] runs; one that exited non-zero, timed out or could not run gives `check failed: <the last non-empty line of its stderr>`.
3. The check's output says due, by `schedule.ts`'s rule, or the outcome is `not due`.
4. The command's runs in flight, the running records on the branch that count for the command (`records.ts`), on any machine, are counted; at or past the cap, the outcome is `cap reached (<count> in flight: <id> on <host>, <id> on <host>)`, each run named by its id and the host that started it (the id alone when the host is unknown).
5. Whether the coding agent can start on this machine is read, once per tick and only now (`agent-runner`'s `readyToRun`); an answer with problems gives `not ready: <the problems, joined by a space>`, nothing is marked and the quota is not read, and every later command of this tick sees the same answer without a second read. Warnings change nothing here.
6. The quota is read, once per tick and only now, and measured against the spend boundary with the state's model and spend cushion; a reading that fails or is not available counts as unknown. No headroom gives `quota: <the headroom rule's reason>`, and every later command of this tick sees the same answer without a second read.
7. The scheduler has not been told to stop while the readings above ran, or the outcome is `not started: the scheduler was stopped`: a stopped scheduler starts nothing, and the readings are where a tick spends its seconds.
8. A run id is minted from the clock, the prompt is `/<command>` (the whole name, `/triage quick`), and a marker [10] is written: a running card with the prompt, the driver's id, the state's model, and `agent-runner`'s mark naming this host and the publish level [13] in force, when there is one: this machine's publish pick [14] for the command, which is `commit` where nobody picked, and no level when the pick is `nothing` (no pid: the run's process does not exist yet; no command: the prompt is what the run counts by).
9. The re-count, below.
10. The run is spawned detached with the id, the prompt, the model and the publish level [13] in force, the one on the marker, which `agent-runner` tells the agent in one sentence after the prompt; a run with no level in force (this machine's publish pick [14] for its command is `nothing`) is given no level and publishes nothing; the outcome is `started <id>` and the decision carries the id as its `run`; a spawn that throws gives `could not start: <the error>`, and the marker stays for the sweep to end on the next tick.

### Two machines

#### Context

**Problem**: two machines' ticks can pass the cap count in the same minute and both write a marker; the branch would then say two runs for a cap of one.

#### Business logic

A marker whose write did not land (the push was rejected, re-applied on origin's new tip, and rejected again) means another machine got there first: the local commit is withdrawn so no record says running for a run that never was, and the outcome is `another machine got there first: <the write's error>`. A marker that landed is ranked: the command's runs in flight are counted again, their ids sorted (ids are start times, so the sort is time order), and the first `cap` ids are the runs. A marker ranked past the cap is withdrawn by the machine that wrote it, nothing is spawned, and the outcome is `cap reached (<count without it> in flight: …)` naming the others. A marker within the cap keeps its place even when a later one lands too.

### The check

#### Context

See `## Context`.

#### Business logic

The check's shell command line runs through `sh -c` with the repository root as the working directory, within the budget the caller gives (one minute in the scheduler's process) and up to four megabytes of output. It is read as its exit status, its stdout and its stderr; a check killed by the budget, or one that could not start, reads as failed with the runtime's message as its stderr when it printed none.
