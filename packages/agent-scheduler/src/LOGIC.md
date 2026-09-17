The rules and the processes of `agent-scheduler`: the schedule [1] a person writes and the due rule, the state [2] the tool keeps per user, the spend boundary [3] copied from The Framework, run records [4] as markers counted across machines, the live record [5] a run's session keeps for the dashboard, one run's [6] life from checkout [7] to record and its resume, the sweep [8], the tick's [9] decisions, the scheduler's process [10] and the command line. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: the user tracks `agent-schedule.md`, runs `agent-scheduler start`, and one agent per due command works the project in its own checkout [7], within the cap [11] and the quota [12]; the user reads why nothing started in the state file, changes the model or the spend cushion for their machine, and stops the scheduler while the agents in flight finish.

**Business logic story**: three processes meet these files. The scheduler's process [10] (`scheduler.ts`) ticks every minute; a tick (`tick.ts`) reads the schedule (`schedule.ts`) and the state (`state.ts`), counts markers (`records.ts`), asks the spend boundary (`quota-boundary.ts`), writes a marker and spawns a run. The run's process (`run.ts`, started as `agent-scheduler run` by `scheduler.ts`) makes the checkout, hands the session the live record's place (`live-card.ts`), prompts the coding agent once, reads the pull request back (`pr.ts`), records the run over its marker and reclaims [13] the checkout, or keeps it when the agent asked; `run --resume` continues such a run. The sweep (`sweep.ts`) runs inside the tick and finishes what a run's process could not. A person's shell reaches all of it through the command line (`cli.ts`). The checkout, the record and the branch's pull are the `branches`, `logs` and `agent-data` packages' rules; the coding agent is `agent-driver`'s.

## Glossary

[1] the schedule: `agent-schedule.md` at the repository root, tracked, written by a person: one list line per command, `- <command>: when \`<check>\`, cap <N>`. Every other line is the person's and is not read.
[2] the state: `.agent-scheduler/state.json` at the repository root, per user, hidden from git through the repository's exclude file: on or off, keep-alive, the model, the spend cushion, the scheduler's pid, the last tick's decisions.
[3] spend boundary: the share of the account's quota week that has elapsed, as a percentage rising continuously with the clock; unattended work stands down once a quota window in force is used past the boundary plus the spend cushion.
[4] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`). Written twice, over the same file: as a marker before the agent exists, and with how it went when the run ends.
[5] live record: the card `<id>.json` and the diary `<id>.jsonl` under `.the-framework/` in a run's checkout, the same two files as the run record, written by `agent-driver`'s session as the agent works; the inbox `inbox.jsonl` beside them carries what reaches the agent from outside.
[6] run: one agent this tool starts: a detached process of the tool's own (`agent-scheduler run`), a checkout, one prompt to the coding agent, and a run record when it ends. Its id is its start time, `2026-09-16T14-01-00-000Z`.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died, and only this machine's.
[9] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[10] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[11] cap: how many runs of one command may be in flight at once, across every machine that shares the repository; 1 when the schedule line names none.
[12] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[13] reclaim: removing a finished agent's checkout once its work is on the remote.
[14] command: a `.claude/skills/<name>` folder tracked in the project, which the coding agent's harness expands from the slash command `/<name>`.

## Business logic — TL;DR

- **The names** (`names.ts`) - the schedule file, the state directory and file, the commands directory, and the defaults: `opus`, a spend cushion of half a day, a cap of 1, a tick every minute, a check's budget of one minute.
- **The schedule** (`schedule.ts`, `schedule.test.ts`) - which lines name a command [14], its check, its interval (`every 6h`: at most that often, from the command's last recorded start) or both, and its cap [11]; a line that cannot be read is named by its number; a check's output says due when it is non-empty JSON; a command's prompt is its slash command.
- **The state** (`state.ts`, `state.test.ts`) - the JSON file and its defaults, hidden from git on the first write, read as the default when missing or unreadable; a scheduler ending clears only its own pid; where a spawned run's stderr lands.
- **The spend boundary** (`quota-boundary.ts`, `quota-boundary.test.ts`) - the reset prose read as an instant, the elapsed share of the week, the windows in force, the limit the cushion moves, and the one line that says why a run may not start.
- **Run records as markers** (`records.ts`, `records.test.ts`) - a marker is a running card with the tool's mark, counted per command across machines; withdrawn when the cap was lost; overwritten by the record at the end.
- **The live record** (`live-card.ts`) - where the session's card, diary and inbox live in the checkout; a card read as this tool's only with the mark; closing a dead run's record from outside.
- **The pull request** (`pr.ts`) - the pull request a branch has, read back with `gh`, or none.
- **One run** (`run.ts`, `run.test.ts`) - marker, checkout, the session with its live record and inbox, the prompt once, the pull request, the record over the marker, the checkout reclaimed; a run with no checkout is recorded `failed`; a signal to the run's process stops it, recorded `stopped`; a run whose last turn asked ends `waiting` and keeps its checkout; a resume continues the same run with the answer or a text.
- **The sweep** (`sweep.ts`, `sweep.test.ts`) - dead runs of this machine recorded and reclaimed; markers with nothing behind them ended; another machine's runs never touched.
- **The tick** (`tick.ts`, `tick.test.ts`) - pull, sweep, then per command in order: the command exists, the interval since its last start, the check, due, the cap, the quota, not stopped meanwhile, the marker, the re-count, the spawn; every outcome's exact line.
- **The processes** (`scheduler.ts`, `scheduler.test.ts`) - the tick wired to the real project, the detached run, the detached start on demand, `start`, `stop` (which leaves a keep-alive scheduler running when asked to) and `status`, and the loop that ticks every minute and, stopped, lets the tick in flight end without starting anything and clears only its own pid.
- **The command line** (`cli.ts`, `cli.test.ts`) - the seven commands, JSON on stdout, a line on stderr, exit 0, 1 or 2, and the project found from inside a checkout.
- **The entry point** (`index.ts`) - re-exports everything a program or a dashboard imports.
- **A test helper** (`test-repo.ts`) - a throwaway project with an origin and an `agent-data` branch, for the tests.
