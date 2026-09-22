The tool's process side: the tick [1] wired to the real project, the run's [2] detached process, and the scheduler's process [3] that ticks every minute between `start` and `stop`. State [4] in files throughout; no process holds anything a restart would lose.

## Context

**User story**: the user runs `agent-scheduler start` once and closes the terminal; a small process of the tool's own keeps ticking, each run is a further process that outlives the tick that started it, and `agent-scheduler stop` ends the scheduler while the agents in flight run to the end; `agent-scheduler run "/work-queue"` starts one run right now with no scheduler at all.

**Business logic story**: the tick's decisions are `tick.ts`'s, one run is `run.ts`'s, the sweep is `sweep.ts`'s; this file gives them the real project: this machine's host name, the `agent-data` package's pull, the `logs` package's markers, `agent-driver`'s quota reader, its readiness check and its Claude Code and Codex drivers, and the state file. The processes it spawns are this same executable, `bin/agent-scheduler`.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] run: one agent this tool starts: a detached process of the tool's own (`agent-scheduler run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[4] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, the scheduler's pid, the last tick's decisions.
[5] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[6] the run's lock: `.agent-scheduler/runs/<id>.lock` at the repository root, holding the pid of the one process of the run at work on it; a pid that is not a live process holds nothing (`run-lock.ts`).

## Business logic — TL;DR

- **A tick of the real project** - the state and the schedule read, the tick decided with this host, the `agent-data` pull, the sweep with a real pid probe, the command's folder, the check with a one-minute budget, the branch's markers and each command's last start, whether Claude Code can start here, Claude Code's quota, ids from the clock, the driver `claude-code`; the record written to the state as `lastTick` and told line by line on the log (`[agent-scheduler] tick <time>: <note>`, `[agent-scheduler]   <command>: <outcome>`).
- **The detached run** - the run's lock [6] taken by the spawning process, then `agent-scheduler run <prompt> --id <id> --command <command>`, with `--model <model>`, `--driver <name>` and `--then <prompt>` when the run has them, detached from the tick, stdin and stdout dropped, stderr to `.agent-scheduler/runs/<id>.stderr`, the run's id in its environment as `AGENT_ID`, and the lock handed to the spawned process; a spawn that fails lets the lock go.
- **Can a run start here** - the coding agent's readiness from `agent-driver` (its CLI installed and logged in: a problem when not); nothing else is probed; what the `check` command answers, and what a person's run and the tick refuse on.
- **A detached start on demand** - `run --detach <prompt>`: the run's lock taken, the marker written and the run's process spawned the way the tick does it, the id answered at once, the lock let go when the marker or the spawn throws; the command is the schedule line the prompt names, else the prompt's first word, so the run counts against that command's cap and interval; the coding agent is Claude Code unless `--driver codex`, and the marker names it; a follow-up given with `--then` is on the marker's mark from the start and passed to the run's process.
- **A detached continuation on demand** - `run --detach --resume <id>`: the run's process spawned to continue it, its id answered at once; the line a dashboard's resume hook runs. A run the project has no record of is refused there and then.
- **A run in this process** - the id given by the tick or minted now, marked already when the id was given, on Claude Code or, with `--driver codex`, on Codex; a follow-up it names runs on the same coding agent, made for the follow-up's own id; a resumed run, and the follow-up its record names, on the coding agent its record names.
- **Either coding agent, unrestricted** - Claude Code with permissions bypassed, Codex with full access, `AGENT_ID` in the agent's environment: whichever coding agent the person picks, it pushes its branch and opens its pull request itself.
- **The model** - the one given; else, on Claude Code, the state's; a Codex run with none given names none, and Codex starts on its own default.
- **`start`** - the state on (and keep-alive when asked); a scheduler's process already alive is left as is; otherwise the tool's own executable spawned detached as `start --foreground`, its output to `.agent-scheduler/scheduler.log`, and its pid and start time written to the state.
- **The loop** - a tick now and every minute, never two at once, a tick that throws logged as `tick failed: …` and the loop going on; a stop signal ends the loop after the tick in flight, which starts nothing more, and clears the pid when it is still this process's.
- **`stop`** - the scheduler's process signalled when alive; the state off with no pid; agents in flight run to the end. Asked to stop unless keep-alive, it leaves a keep-alive scheduler as it is and says it kept it: the one reader of keep-alive.
- **`status`** - the state, plus whether its pid is a live process.

## Business logic

### A tick of the real project

#### Context

See `## Context`.

#### Business logic

The state and the schedule are read from the repository. The tick decides with: this machine's host name; the `agent-data` package's pull of the branch; the sweep with this host and the live-pid probe (`run-lock.ts`); whether `.claude/skills/<name>` is a directory; the check run through the shell with a one-minute budget; the command's markers [5] on the branch; whether Claude Code can start on this machine (below); Claude Code's quota read by `agent-driver` in the repository; ids minted from the clock; the marker written to and withdrawn from the branch; the detached run; and the driver id `claude-code` on the marker's card. The tick's record is written to the state as `lastTick`, and told on the log one line per decision.

### Can a run start here

#### Context

**User story**: the user picks Claude Code or Codex in a dashboard's launcher, and a missing or logged-out CLI is said under the prompt box before the Start (the project's check hook runs `agent-scheduler check`).

**Problem**: a run on a coding agent whose CLI is missing or logged out takes a checkout and a marker, then dies before its first turn; the check costs about a second, the dead run a branch.

#### Business logic

The answer is `agent-driver`'s readiness for the coding agent named (problems: its CLI not found, or not logged in; a warning: running as root), and nothing more: the project's git host is not probed, since a project with no git host package runs fine, and one whose git host cannot answer says so in the run's own log. The tick asks it for Claude Code, the coding agent every scheduled run is on.

### The detached run

#### Context

**Problem**: a run must outlive the tick, and the scheduler's process, that started it, and a run that dies before it writes anything must leave a trace the sweep can read.

#### Business logic

The spawning process first takes the run's lock [6] with its own pid, waiting while another live process holds it, so that from before the run's process exists a sweep reads the run as held rather than gone. The run is the tool's own executable started as a detached process with `run <prompt> --id <id> --command <command>`, then `--model <model>` when the run has a model, `--driver <name>` when it has a coding agent named and `--then <prompt>` when it names a follow-up (a person's detached start only; the tick's runs name none) (left out, the run's own defaults apply), the repository as its working directory, no stdin, stdout dropped, stderr appended to `.agent-scheduler/runs/<id>.stderr`, and the run's id as `AGENT_ID` in its environment. The tick waits only until the process has spawned; the lock is then handed to the spawned process's pid, which finds it its own when it takes it and holds it for the run's life. A spawn that fails lets the lock go and is the tick's `could not start: …`.

### A detached start on demand

#### Context

**User story**: the user presses Start on a dashboard, or types `agent-scheduler run --detach "/triage quick"`, and gets the run's id back at once while the agent works in its own process; the dashboard shows the run from its live record like a scheduled one.

**Problem**: `run <prompt>` answers only when the agent has ended; a dashboard's start hook needs the id now, and must not hold a process for the run's whole life.

#### Business logic

`run --detach <prompt>` mints the id from the clock, takes the command from the prompt by the schedule's rule (`schedule.ts`: the schedule line the prompt names without its slash, `/triage quick` → `triage quick`, else the prompt's first word, `/work-queue now` → `work-queue`), the coding agent from `--driver` (Claude Code when absent) and the model by the rule below, takes the run's lock [6] with its own pid before anything is written, so that a scheduler's sweep reading the marker before the run's process has its checkout sees the run held, writes the marker on the branch, naming the coding agent, with the tool's mark naming the command, this host and, when `--then` was given, the follow-up's prompt (no pid: the process does not exist yet, and the lock is what says the run lives; a marker that could not even be committed is logged), spawns the run's process exactly as the tick does, handing it the lock, with the id, the coding agent, the model and the follow-up, and answers the id, the command, the driver and, when the run has one, the model. When the marker's write or the spawn throws, the lock is let go and the error stands. The run's process, given its id, does not mark itself again.

Continuing an ended run has the same shape: `run --detach --resume <id>`, with the user's text or their `--answer`, spawns the run's process to continue that run and answers its id at once — what a dashboard's resume hook runs, for the same reason its start hook runs the detached start. One thing is decided before anything is spawned: a run this project has no record of is refused while someone is still listening, since everything after the spawn is the resumed run's own record and nobody would read a failure there. The run's process does the rest — the checkout it kept or a fresh one on its branch, the session resumed, the diary continued.

### A run in this process

#### Context

See `run.ts`.

#### Business logic

The tick's run comes with its id, its command and its model, and its marker already on the branch, so it does not mark itself. A person's run (`agent-scheduler run <prompt>`) mints its id from now and marks itself. The coding agent is Claude Code through `agent-driver`, or Codex when `--driver codex` was given. A run that names a follow-up (`run --then`, `run.ts`) runs it on the same coding agent, a driver made for the follow-up's own id, so its `AGENT_ID` is its own. A resumed run (`run --resume`) is on the coding agent its record names, because the session it resumes is that coding agent's, and so is the follow-up its record names; a record naming one this package cannot start is refused.

### Either coding agent, unrestricted

#### Context

**User story**: the user picks Claude Code or Codex for a run, on the command line or in a dashboard's launcher, and gets the same thing from either: the agent does the work, pushes its branch and opens its pull request.

**Problem**: Codex's default sandbox lets the agent write in its checkout only, which is enough when something outside the sandbox publishes the work. Here nothing does: the agent publishes itself.

#### Business logic

Claude Code is started with permissions bypassed (an unattended run can answer no prompt). Codex is started with full access instead of its default sandbox. Both get the run's id as `AGENT_ID` in their environment, which the tickets skill reads as the claiming agent's id. `agent-driver`'s own default for Codex stays the workspace-only sandbox; only `agent-scheduler` passes the wider setting.

### The model

#### Context

**Problem**: the state's model (`agent-scheduler model <id>`) is a Claude model; handed to Codex it would fail the run at its start.

#### Business logic

A model given with `--model` is passed to either coding agent. With none given, a Claude Code run takes the state's model; a Codex run names no model, on its card and to Codex, and Codex starts on its own default. A resumed run takes the given model, else the one its record carries, else none.

### `start`

#### Context

See `## Context`.

#### Business logic

`start` writes the state on, and keep-alive on when `--keep-alive` was given. When the state names a pid that is alive on this machine and is not this process, a scheduler is already running and the state is answered as is. With `--foreground`, this process itself becomes the scheduler's process [3] and runs the loop until stopped. Otherwise the tool's own executable is spawned detached as `start --foreground`, the repository as its working directory, its stdout and stderr appended to `.agent-scheduler/scheduler.log`, and once it has spawned its pid and the start time are written to the state and answered.

### The loop

#### Context

See `## Context`.

#### Business logic

The scheduler's process first writes its own pid and start time to the state. It ticks at once and then every interval (one minute); ticks queue behind each other, so two never run at once, and a tick that throws is logged as `[agent-scheduler] tick failed: <message>` without ending the loop. A SIGINT or SIGTERM stops the clock and waits for the tick in flight; that tick is told the scheduler was stopped, so it starts nothing more (its decision lines say `not started: the scheduler was stopped`). The pid and the start time are then removed from the state only when the pid is still this process's: a dashboard's close hook stops this scheduler and its open hook starts the next one before this tick is over, and the next one's pid stays. The process ends; the state's `on` is left as it was, so a `stop` says off and a killed scheduler stays on for the next `start`.

### `stop`

#### Context

See `## Context`.

#### Business logic

`stop` sends SIGINT to the state's pid when that process is alive (a process gone between the probe and the signal is ignored), then writes the state off with no pid and no start time, and answers it with `kept: false`. Runs in flight are their own processes and are not signalled: they run to the end. Asked to stop unless keep-alive (the line a dashboard runs when it closes), it first reads the state: keep-alive on means nothing is signalled and nothing written, and the state is answered as it is with `kept: true`; keep-alive off means the plain stop. A plain `stop` stops a keep-alive scheduler too: it is how a person turns the tool off.

### `status`

#### Context

See `## Context`.

#### Business logic

`status` answers the state as read plus `running`: whether the state names a pid and that pid is a live process on this machine.
