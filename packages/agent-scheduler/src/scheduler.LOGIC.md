The tool's process side: the tick [1] wired to the real project, the run's [2] detached process, and the scheduler's process [3] that ticks every minute between `start` and `stop`. State [4] in files throughout; no process holds anything a restart would lose.

## Context

**User story**: the user runs `agent-scheduler start` once and closes the terminal; a small process of the tool's own keeps ticking, each run is a further process that outlives the tick that started it, and `agent-scheduler stop` ends the scheduler while the agents in flight run to the end; `agent-scheduler run "/work-queue"` starts one run right now with no scheduler at all.

**Business logic story**: the tick's decisions are `tick.ts`'s, one run is `run.ts`'s, the sweep is `sweep.ts`'s; this file gives them the real project: this machine's host name, the `agent-data` package's pull, the `logs` package's markers, `agent-driver`'s quota reader and Claude Code driver, and the state file. The processes it spawns are this same executable, `bin/agent-scheduler`.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] run: one agent this tool starts: a detached process of the tool's own (`agent-scheduler run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[4] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, the scheduler's pid, the last tick's decisions.
[5] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.

## Business logic — TL;DR

- **A tick of the real project** - the state and the schedule read, the tick decided with this host, the `agent-data` pull, the sweep with a real pid probe, the command's folder, the check with a one-minute budget, the branch's markers and each command's last start, Claude Code's quota, ids from the clock, the driver `claude-code`; the record written to the state as `lastTick` and told line by line on the log (`[agent-scheduler] tick <time>: <note>`, `[agent-scheduler]   <command>: <outcome>`).
- **The detached run** - `agent-scheduler run <prompt> --id <id> --command <command> --model <model>`, detached from the tick, stdin and stdout dropped, stderr to `.agent-scheduler/runs/<id>.stderr`, the run's id in its environment as `AGENT_ID`.
- **A detached start on demand** - `run --detach <prompt>`: the marker written and the run's process spawned the way the tick does it, the id answered at once; the command is the prompt's first word, so the run counts against that command's cap.
- **A run in this process** - the id given by the tick or minted now, the model given or the state's, marked already when the id was given, Claude Code with permissions bypassed and `AGENT_ID` in its environment.
- **`start`** - the state on (and keep-alive when asked); a scheduler's process already alive is left as is; otherwise the tool's own executable spawned detached as `start --foreground`, its output to `.agent-scheduler/scheduler.log`, and its pid and start time written to the state.
- **The loop** - a tick now and every minute, never two at once, a tick that throws logged as `tick failed: …` and the loop going on; a stop signal ends the loop after the tick in flight, which starts nothing more, and clears the pid when it is still this process's.
- **`stop`** - the scheduler's process signalled when alive; the state off with no pid; agents in flight run to the end. Asked to stop unless keep-alive, it leaves a keep-alive scheduler as it is and says it kept it: the one reader of keep-alive.
- **`status`** - the state, plus whether its pid is a live process.
- **A live pid** - probed by signal 0 on this machine; a process that exists but belongs to another user counts as alive; a pid on another host is unknowable here.

## Business logic

### A tick of the real project

#### Context

See `## Context`.

#### Business logic

The state and the schedule are read from the repository. The tick decides with: this machine's host name; the `agent-data` package's pull of the branch; the sweep with this host and the live-pid probe; whether `.claude/skills/<name>` is a directory; the check run through the shell with a one-minute budget; the command's markers [5] on the branch; Claude Code's quota read by `agent-driver` in the repository; ids minted from the clock; the marker written to and withdrawn from the branch; the detached run; and the driver id `claude-code` on the marker's card. The tick's record is written to the state as `lastTick`, and told on the log one line per decision.

### The detached run

#### Context

**Problem**: a run must outlive the tick, and the scheduler's process, that started it, and a run that dies before it writes anything must leave a trace the sweep can read.

#### Business logic

The run is the tool's own executable started as a detached process with `run <prompt> --id <id> --command <command> --model <model>`, the repository as its working directory, no stdin, stdout dropped, stderr appended to `.agent-scheduler/runs/<id>.stderr`, and the run's id as `AGENT_ID` in its environment. The tick waits only until the process has spawned; a spawn that fails is the tick's `could not start: …`.

### A detached start on demand

#### Context

**User story**: the user presses Start on a dashboard, or types `agent-scheduler run --detach "/triage-quick"`, and gets the run's id back at once while the agent works in its own process; the dashboard shows the run from its live record like a scheduled one.

**Problem**: `run <prompt>` answers only when the agent has ended; a dashboard's start hook needs the id now, and must not hold a process for the run's whole life.

#### Business logic

`run --detach <prompt>` mints the id from the clock, takes the command from the prompt's first word without its slash (`/work-queue now` → `work-queue`; a plain prompt's first word otherwise) and the model from the option or the state, writes the marker on the branch with the tool's mark naming the command and this host (no pid: the process does not exist yet; a marker that could not even be committed is logged), spawns the run's process exactly as the tick does, with the id, and answers the id, the command and the model. The run's process, given its id, does not mark itself again.

### A run in this process

#### Context

See `run.ts`.

#### Business logic

The tick's run comes with its id, its command and its model, and its marker already on the branch, so it does not mark itself. A person's run (`agent-scheduler run <prompt>`) mints its id from now, takes the state's model unless `--model` says otherwise, and marks itself. Either way the coding agent is Claude Code through `agent-driver`, with permissions bypassed (an unattended run can answer no prompt) and the run's id as `AGENT_ID` in its environment, which the tickets skill reads as the claiming agent's id.

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
