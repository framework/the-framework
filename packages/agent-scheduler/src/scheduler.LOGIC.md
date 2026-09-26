The tool's process side: the tick [1] wired to the real project, and the scheduler's process [3] that ticks every minute between `start` and `stop`. State [4] in files throughout; no process holds anything a restart would lose.

## Context

**User story**: the user runs `agent-scheduler start` once and closes the terminal; a small process of the tool's own keeps ticking, each run is a further process, `agent-runner`'s, that outlives the tick that started it, and `agent-scheduler stop` ends the scheduler while the agents in flight run to the end.

**Business logic story**: the tick's decisions are `tick.ts`'s; one run, the sweep, the markers, the readiness check and the detached spawn are `agent-runner`'s; this file gives the tick the real project: this machine's host name, the `agent-data` package's pull, `agent-runner`'s sweep, markers, readiness check and spawn, the run counts of `records.ts`, `@agent-driver/claude`'s quota reader, and the state file. The process it spawns itself is this same executable, `bin/agent-scheduler`: the scheduler's process.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] run: one agent the scheduler starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[4] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches, the scheduler's pid, the last tick's decisions.

## Business logic — TL;DR

- **A tick of the real project** - the state and the schedule read, the tick decided with this host, the `agent-data` pull, `agent-runner`'s sweep with a real pid probe, the command's folder, the check with a one-minute budget, the branch's markers and each command's last start counted by the schedule read, whether Claude Code can start here (`agent-runner`'s readiness check), Claude Code's quota, ids from the clock, the driver `claude-code`, and each run spawned by `agent-runner` with the id, the prompt and the state's model; the record written to the state as `lastTick` and told line by line on the log (`[agent-scheduler] tick <time>: <note>`, `[agent-scheduler]   <command>: <outcome>`).
- **`start`** - the state on (and keep-alive when asked); a scheduler's process already alive is left as is; otherwise the tool's own executable spawned detached as `start --foreground`, its output to `.agent-scheduler/scheduler.log`, and its pid and start time written to the state.
- **The loop** - a tick now and every minute, never two at once, a tick that throws logged as `tick failed: …` and the loop going on; a stop signal ends the loop after the tick in flight, which starts nothing more, and clears the pid when it is still this process's.
- **`stop`** - the scheduler's process signalled when alive; the state off with no pid; agents in flight run to the end. Asked to stop unless keep-alive, it leaves a keep-alive scheduler as it is and says it kept it: the one reader of keep-alive.
- **`status`** - the state, plus whether its pid is a live process.

## Business logic

### A tick of the real project

#### Context

See `## Context`.

#### Business logic

The state and the schedule are read from the repository. The tick decides with: this machine's host name; the `agent-data` package's pull of the branch; `agent-runner`'s sweep with this host and its live-pid probe; whether `.claude/skills/<name>` is a directory; the check run through the shell with a one-minute budget; the command's running records in flight on the branch and its last start, each run counted for a command by the schedule just read (`records.ts`); whether Claude Code can start on this machine, `agent-runner`'s readiness check; Claude Code's quota read by `@agent-driver/claude` in the repository; ids minted from the clock by `agent-runner`'s rule; the marker written to and withdrawn from the branch through `agent-runner`; the run spawned detached by `agent-runner` (`agent-runner run <prompt> --id <id> --model <the state's model>`, with the run's lock taken before the spawn and handed to the run's process, its stderr kept under `.agent-runner/runs/`), on Claude Code, `agent-runner`'s default; and the driver id `claude-code` on the marker's card. The tick's record is written to the state as `lastTick`, and told on the log one line per decision.

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
