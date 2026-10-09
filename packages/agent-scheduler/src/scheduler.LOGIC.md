The tool's process side: the tick [1] wired to the real project, and the scheduler's process [3] that ticks every minute between `start` and `stop`. State [4] in files throughout; no process holds anything a restart would lose.

## Context

**User story**: the user runs `agent-scheduler start` once and closes the terminal; a small process of the tool's own keeps ticking, each run is a further process, `agent-runner`'s, that outlives the tick that started it, and `agent-scheduler stop` ends the scheduler while the agents in flight run to the end.

**Business logic story**: the tick's decisions are `tick.ts`'s; one run, the sweep, the markers, the readiness check and the detached spawn are `agent-runner`'s; this file gives the tick the real project: this machine's host name, the `agent-data` package's pull, `agent-runner`'s sweep, markers, readiness check and spawn, `start-point.ts`'s question whether a file is on the start point [6], asked of the repository with git, the run counts of `records.ts`, `@openagt/agent-driver-claude`'s quota reader, and the state file. The process it spawns itself is this same executable, `bin/agent-scheduler`: the scheduler's process.

## Glossary

[1] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command, each decision one line in the state.
[2] run: one agent the scheduler starts: a detached process of `agent-runner` (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[3] the scheduler's process: the tool's own process between `start` and `stop`, ticking every minute; the state holds its pid.
[4] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches, pace picks, agents picks and publish picks, the scheduler's pid, the last tick's decisions.
[5] attached text: a text handed to a run's agent with the run's first prompt, apart from the prompt (`agent-runner run --attach`): the agent reads it after the prompt, and no later prompt of the run carries it. A run that a check started is handed what the check printed this way.
[6] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[7] automation: a person's own prompt saved as a scheduled command, with the `schedule` the person picked (the key where a skill says when its command is due), an interval, a check (a shell line whose output says whether the command is due) or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.

## Business logic — TL;DR

- **A tick of the real project** - the schedule read, then the state, out of which this machine's switch and picks are first taken for every name given up (an automation kept on this machine [7] whose file is gone, a name a skill and such an automation both have; `state.ts`), the tick decided with this host, the `agent-data` pull, `agent-runner`'s sweep with a real pid probe and its detached continuation of a parent run, the check with a one-minute budget and the time the tick gives it as `$LAST_RUN`, the branch's markers and each command's last start counted by the schedule read, an automation kept on this machine counting this machine's runs alone, whether a skill's file is on the start point [6], which is brought up to date with one fetch the first time the tick asks, whether Claude Code can start here (`agent-runner`'s readiness check), Claude Code's quota, ids from the clock, the driver `claude-code`, and each run spawned by `agent-runner` with the id, the prompt, the start the tick gives it, the state's model and the publish level this machine picked for the command (`commit`, `branch`, `pr` or `merge`; `commit` where nobody picked, none for a pick of `nothing`) and, for a run that a check started, its attached text [5], what the check printed as the tick words it, a run of an automation kept on this machine always having one, the automation's text first; whether a command is still switched on on this machine, read from the state anew just before its run is marked; the record written to the state as `lastTick`, without the commands whose file went while the tick ran, an automation kept on this machine that went so giving up its switch and picks in the same write, and that record, as written, answered and told line by line on the log (`[agent-scheduler] tick <time>: <note>`, `[agent-scheduler]   <command>: <outcome>`).
- **`start`** - the state on (and keep-alive when asked); a scheduler's process already alive is left as is; otherwise the tool's own executable spawned detached as `start --foreground`, its output to `.agent-scheduler/scheduler.log`, and its pid and start time written to the state.
- **The loop** - a tick now and every minute, never two at once, a tick that throws logged as `tick failed: …` and the loop going on; a stop signal ends the loop after the tick in flight, which starts nothing more and records nothing, and clears the pid when it is still this process's; when the state names no pid or another's, as after `stop`, nothing is written, so a state file a clean-up removed meanwhile is not put back.
- **`stop`** - the scheduler's process signalled when alive; the state off with no pid; agents in flight run to the end. Asked to stop unless keep-alive, it leaves a keep-alive scheduler as it is and says it kept it: the one reader of keep-alive.
- **`status`** - the state, plus whether its pid is a live process.

## Business logic

### A tick of the real project

#### Context

See `## Context`.

#### Business logic

The schedule is read from the project's skills and from the automations kept on this machine [7] (`schedule.ts`), and the state from the repository. Before anything is decided, the names given up are worked out from the state's last tick and that schedule (`state.ts`): an automation kept on this machine that the last tick listed and whose file is gone, removed or renamed, and a name a skill of the project and such an automation both have. When there is one, the state is written once with nothing left under those names, neither this machine's schedule switch nor its pace pick, agents pick and publish pick, and the tick decides with the state as written. When there is none, the state is read and not written. An automation whose file is still there gives nothing up, also while a slip in the file keeps it off the list. The tick decides with: this machine's host name; the `agent-data` package's pull of the branch; `agent-runner`'s sweep with this host, its live-pid probe, and `agent-runner`'s detached continuation, so a run the sweep ends can continue the run it was started for; the check run through the shell with a one-minute budget and, as `$LAST_RUN`, the time the tick gives it; the command's running records in flight on the branch and its last start, each run counted for a command by the schedule just read and by this machine's host name, since an automation kept on this machine counts the runs this machine started alone (`records.ts`); one question for the whole tick, whether a file is on the start point [6], answered from the repository with git (`start-point.ts`): the start point is read, origin's default branch fetched with a wait of 5 seconds at most, the first time the tick asks, and that reading answers every later question of the same tick; whether Claude Code can start on this machine, `agent-runner`'s readiness check; Claude Code's quota read by `@openagt/agent-driver-claude` in the repository; ids minted from the clock by `agent-runner`'s rule; the marker written to and withdrawn from the branch through `agent-runner`; the run spawned detached by `agent-runner` (`agent-runner run <prompt> --id <id> --started <time> --model <the state's model>`, the time being the start the tick gives the run, the moment it turned to the run's command, and `--publish <level>` with the publish level this machine picked for the command, `commit` where nobody picked, the flag left out for a pick of `nothing`, and `--attach=<text>` with the run's attached text [5], what the command's check printed as the tick words it, the flag left out for a run of a skill's command that its pace alone started, and always there for a run of an automation kept on this machine, whose text comes first in it, with the run's lock taken before the spawn and handed to the run's process, its stderr kept under `.agent-runner/runs/`), on Claude Code, `agent-runner`'s default; and the driver id `claude-code` on the marker's card. The tick is also given one more question, asked just before a run is marked: whether the command is switched on on this machine at that moment, answered from the state file read anew, so a command a person switched off, or removed, while the tick ran its check and its readings starts nothing (`tick.ts`).

The tick's record is written to the state as `lastTick`. Before it is written, the schedule is read once more from the files on disk. A command the record lists and that this second reading lists no more, its file removed by its person while the tick ran, is taken off the record as it is written, out of the schedule the tick read and out of what it decided (`state.ts`): whoever lists the record's commands, a dashboard, is not shown for another minute a command that is gone. When such a command was an automation kept on this machine [7], this machine's switch and picks under its name are taken out of the state in the same write: off the record, the next tick would not know the automation had been listed, and could not give its name up. What is told on the log, one line per decision, and what the tick answers to whoever ran it (`agent-scheduler tick`), is the record as it was written to the state, so without the commands that went. A tick cut short by a stop writes no record at all, and tells and answers the record as the tick decided it.

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
