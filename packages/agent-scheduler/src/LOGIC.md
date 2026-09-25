The rules and the processes of `agent-scheduler`: the schedule [1] a person writes and the due rule, the state [2] the tool keeps per user, the spend boundary [3] copied from The Framework, the runs [5] a command has, counted off the run records [4] across machines, the tick's [8] decisions, the scheduler's process [9] and the command line. One run, its marker, its lock and the sweep [7] are `agent-runner`'s, which every run the tool starts is. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: the user tracks `agent-schedule.md`, runs `agent-scheduler start`, and one agent per due command works the project in its own checkout [6], within the cap [10] and the quota [11]; the user reads why nothing started in the state file, changes the model or the spend cushion for their machine, turns a scheduled command on or off for their machine with its schedule switch [14], and stops the scheduler while the agents in flight finish.

**Business logic story**: the scheduler's process [9] (`scheduler.ts`) ticks every minute; a tick (`tick.ts`) reads the schedule (`schedule.ts`) and the state (`state.ts`), runs `agent-runner`'s sweep, counts each command's runs in flight and its last start off the run records (`records.ts`), asks `agent-runner` whether the coding agent can start and itself the spend boundary (`quota-boundary.ts`), writes a marker through `agent-runner` and has `agent-runner` spawn the run with the state's model. From there the run is `agent-runner`'s own process, which records itself and reclaims [12] its checkout. A person's shell reaches the scheduler through the command line (`cli.ts`). The branch's pull is the `agent-data` package's rule; the run, the record and the checkout are `agent-runner`'s, `logs`' and `branches`'.

## Glossary

[1] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command, `- <command>: when \`<check>\`, cap <N>`. Every other line is the person's and is not read.
[2] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches [14], the scheduler's pid, the last tick's decisions and the schedule it read.
[3] spend boundary: the share of the account's quota week that has elapsed, as a percentage rising continuously with the clock; unattended work stands down once a quota window in force is used past the boundary plus the spend cushion.
[4] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`), written by `agent-runner`. Written twice, over the same file: as a marker before the agent exists, and with how it went when the run ends.
[5] run: one agent this tool starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends. Its id is its start time, `2026-09-16T14-01-00-000Z`.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] sweep: `agent-runner`'s pass, run on every tick, that records and reclaims the runs of this machine whose process died, and only this machine's.
[8] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[9] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[10] cap: how many runs of one command may be in flight at once, across every machine that shares the repository; 1 when the schedule line names none.
[11] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[12] reclaim: removing a finished agent's checkout once its work is on the remote.
[13] command: a schedule line's name, a skill folder's name under `.claude/skills/` and at most one word the skill takes as its argument (`triage quick`), which the coding agent's harness expands from the slash command `/<name>`.
[14] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the state, not in the schedule. The schedule line is the default where nobody switched the command: on, unless the line says `off`.

## Business logic — TL;DR

- **The names** (`names.ts`) - the schedule file, the state directory and file, the scheduler's log, the commands directory, and the defaults: `opus`, a spend cushion of half a day, a cap of 1, a tick every minute, a check's budget of one minute.
- **The schedule** (`schedule.ts`, `schedule.test.ts`) - which lines name a command [13] (a folder name, and at most one word after it for the skill), its check, its interval (`every 6h`: at most that often, from the command's last recorded start) or both, its cap [10], and `off` for a command that runs only where a machine switched it on [14]; a line that cannot be read is named by its number; a check's output says due when it is non-empty JSON; a command's prompt is its slash command, and a run's prompt is counted under the line it names, else its first word.
- **The state** (`state.ts`, `state.test.ts`) - the JSON file and its defaults, hidden from git on the first write, read as the default when missing or unreadable; a schedule switch [14] kept only where it differs from its line; a scheduler ending clears only its own pid.
- **The spend boundary** (`quota-boundary.ts`, `quota-boundary.test.ts`) - the reset prose read as an instant, the elapsed share of the week, the windows in force, the limit the cushion moves, and the one line that says why a run may not start.
- **A command's runs** (`records.ts`, `records.test.ts`) - the command a run counts for, read off its prompt against the schedule, for the runs `agent-runner` started only; a command's runs in flight and its last start, on any machine.
- **The tick** (`tick.ts`, `tick.test.ts`) - pull, sweep, then per command in order: the command exists, the schedule switch [14], the interval since its last start, the check, due, the cap, the coding agent can start, the quota, not stopped meanwhile, the marker, the re-count, the spawn; every outcome's exact line; the schedule as read, on every tick record.
- **The processes** (`scheduler.ts`) - the tick wired to the real project and to `agent-runner` (its sweep, its readiness check, its markers, its spawn with the state's model), `start`, `stop` (which leaves a keep-alive scheduler running when asked to) and `status`, and the loop that ticks every minute and, stopped, lets the tick in flight end without starting anything and clears only its own pid.
- **The dashboard's hooks** (`init.ts`, `init.test.ts`) - this tool's lines written into the dashboard's `.the-framework/hooks.yml` by `agent-runner`'s writer, so its opening and closing, its spend-offset slider and its schedule switches run through this tool.
- **The command line** (`cli.ts`, `cli.test.ts`) - the eight commands, `switch` refused for a command the schedule has no line for, JSON on stdout, a line on stderr, exit 0, 1 or 2, and the project found from inside a checkout.
- **The entry point** (`index.ts`) - re-exports everything a program or a dashboard imports.
- **A test helper** (`test-repo.ts`) - a throwaway project with an origin and an `agent-data` branch, for the tests.
