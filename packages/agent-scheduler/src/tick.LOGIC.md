One tick [1]: pull the `agent-data` branch [2], sweep [3], read the schedule [4], and for each command [5] decide in the cheapest order (does the project have the command, is it due, is its cap [6] reached, is there quota [7]) then mark and spawn one run [8]. Every decision is one line in the state [9], so a dashboard or a person reads why nothing started without a log. The quota is read once per tick and only when everything else says start: a read spawns the coding agent's CLI, and the agent's own usage fetch is refused upstream when asked too often. Two machines can tick the same schedule: each marks before it spawns, then counts again, and the marker that landed past the cap is withdrawn by the machine that wrote it.

## Context

**User story**: every minute the user's scheduler looks at the schedule; when the queue holds work and nothing is running it, one agent starts; the user reads in the state, per command, `started <id>`, `not due`, `cap reached (1 in flight: <id> on <host>)`, `quota: …` or `no such command in this project`; a schedule line with a typo shows as `line 3: unreadable: …` while the other lines still run.

**Business logic story**: this file decides with every reading handed to it (the pull, the sweep, the command's existence, the check, the in-flight markers, the quota, the marker writes, the spawn); `scheduler.ts` wires it to the real project. The marker rule is `records.ts`'s, the due rule `schedule.ts`'s, the headroom rule `quota-boundary.ts`'s.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died.
[4] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command.
[5] command: a `.claude/skills/<name>` folder tracked in the project, which the coding agent's harness expands from the slash command `/<name>`.
[6] cap: how many runs of one command may be in flight at once, across every machine that shares the repository.
[7] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[8] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.
[9] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, the model, the spend cushion, the last tick's decisions.
[10] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[11] check: the shell command a schedule line puts after `when`, run at the repository root; its output says whether the command is due.

## Business logic — TL;DR

- **Before any decision** - the branch is pulled; a pull that fails ends the tick with the note `agent-data could not be pulled: <error>`, since a stale branch must start nothing; the sweep runs; a state that is off ends the tick with the note `off`; no schedule file ends it with `no agent-schedule.md`.
- **Unreadable lines** - each is one decision under `line <N>` with `unreadable: <text>`.
- **Per command, in order** - `no such command in this project`; for a line with an interval, `not due (last start <age> ago, every <interval>)` while the command's last recorded start on any machine is younger than the interval, and no check runs; for a line with a check, `check failed: <last line of stderr>` or `not due`; `cap reached (<N> in flight: <id> on <host>, …)`; `quota: <reason>`; then the marker, the re-count, and `started <id>` or `could not start: <error>`.
- **Two machines** - a marker whose push was rejected twice is withdrawn: `another machine got there first: <error>`; a marker that landed but ranks past the cap among the in-flight ids in time order is withdrawn: `cap reached (…)` naming the others.
- **The project has a command** - its `.claude/skills/<name>` is a directory, tracked file or link; a name outside lowercase letters, digits and dashes never matches.
- **The check** - run through `sh -c` at the repository root within its budget; its exit code, stdout and stderr are what the tick reads.
- **The interval** - read before the check, because the run records are on disk while the check spawns a shell; a command never started is past every interval; the age in the line is floored to minutes, hours or days, `less than a minute` under one.

## Business logic

### Before any decision

#### Context

See `## Context`.

#### Business logic

The tick's time is the clock's now. The `agent-data` branch is pulled first; when the pull fails, the tick records no decisions and the note `agent-data could not be pulled: <the pull's error>`. Then the sweep runs, whether or not the state is on. When the state is off, the note is `off` and no command is looked at, no check run. When there is no schedule file, the note is `no agent-schedule.md`.

### Unreadable lines

#### Context

See `schedule.ts`'s unreadable list line.

#### Business logic

Before the commands, every unreadable list line of the schedule is one decision: the command named `line <its number>`, the outcome `unreadable: <its text>`. The readable lines are decided as usual.

### Per command, in order

#### Context

**Problem**: the readings cost more as they go: a directory stat, a shell command, a listing of the branch's runs, a spawn of the coding agent's CLI; each command stops at the first reading that says no.

#### Business logic

When the line carries an interval, the command's last start on any machine is read off the run records (the newest start among the records with this tool's mark for the command, whatever became of the run); a start younger than the interval decides `not due (last start <age> ago, every <interval>)` and nothing else of the line runs; a command never started is past every interval. When the line carries a check, it runs next. For each command of the schedule, in the file's order:
1. The project has the command, or the outcome is `no such command in this project` and the check is not run.
2. The check [11] runs; one that exited non-zero, timed out or could not run gives `check failed: <the last non-empty line of its stderr>`.
3. The check's output says due, by `schedule.ts`'s rule, or the outcome is `not due`.
4. The command's runs in flight, the running markers on the branch on any machine, are counted; at or past the cap, the outcome is `cap reached (<count> in flight: <id> on <host>, <id> on <host>)`, each run named by its id and the host that started it (the id alone when the host is unknown).
5. The quota is read, once per tick and only now, and measured against the spend boundary with the state's model and spend cushion; a reading that fails or is not available counts as unknown. No headroom gives `quota: <the headroom rule's reason>`, and every later command of this tick sees the same answer without a second read.
6. A run id is minted from the clock, the prompt is `/<command>`, and a marker [10] is written: a running card with the prompt, the driver's id, the state's model, and the mark naming the command and this host (no pid: the run's process does not exist yet).
7. The re-count, below.
8. The run is spawned detached with the id, the command, the prompt and the model; the outcome is `started <id>` and the decision carries the id as its `run`; a spawn that throws gives `could not start: <the error>`, and the marker stays for the sweep to end on the next tick.

### Two machines

#### Context

**Problem**: two machines' ticks can pass the cap count in the same minute and both write a marker; the branch would then say two runs for a cap of one.

#### Business logic

A marker whose write did not land (the push was rejected, re-applied on origin's new tip, and rejected again) means another machine got there first: the local commit is withdrawn so no record says running for a run that never was, and the outcome is `another machine got there first: <the write's error>`. A marker that landed is ranked: the command's runs in flight are counted again, their ids sorted (ids are start times, so the sort is time order), and the first `cap` ids are the runs. A marker ranked past the cap is withdrawn by the machine that wrote it, nothing is spawned, and the outcome is `cap reached (<count without it> in flight: …)` naming the others. A marker within the cap keeps its place even when a later one lands too.

### The project has a command

#### Context

**Problem**: the schedule may name a command the project does not have, or one this machine's checkout has not pulled yet; the coding agent would then get a slash command it cannot expand.

#### Business logic

A command exists when `.claude/skills/<name>` at the repository root is a directory, whether a tracked folder or a link to one. A name that is not lowercase letters, digits and dashes never exists, so a schedule line cannot reach outside that folder.

### The check

#### Context

See `## Context`.

#### Business logic

The check's shell command line runs through `sh -c` with the repository root as the working directory, within the budget the caller gives (one minute in the scheduler's process) and up to four megabytes of output. It is read as its exit status, its stdout and its stderr; a check killed by the budget, or one that could not start, reads as failed with the runtime's message as its stderr when it printed none.
