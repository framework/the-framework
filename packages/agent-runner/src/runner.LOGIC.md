The tool's process side: a run [1] in this process, the same run detached in its own process and answered at once, a resume either way, and whether a run can start on this machine at all. State in files throughout; nothing waits in memory.

## Context

**User story**: the user presses Start in the dashboard and gets the run's id back at once while the agent works in its own process; answers a run's question and gets the same back; picks Claude Code or Codex in the launcher and reads under the prompt box, before the Start, what would stop the run; or types `agent-runner run "/work-queue"` and waits for the outcome in the shell.

**Business logic story**: one run is `run.ts`'s; this file gives it the real project: this machine's host name, this package's markers (`records.ts`), the `logs` package's reading of a run, the readiness check and the driver of each coding agent, from its own package: `@agent-driver/claude` for Claude Code, `@agent-driver/codex` for Codex. The processes it spawns are this same executable, `bin/agent-runner`. A scheduler's tick uses two of its pieces: the readiness check, and the spawn of a run whose marker the tick wrote.

## Glossary

[1] run: one agent this tool starts: a process of the tool's own (`agent-runner run`), a checkout, one prompt to the coding agent, and a run record when it ends.
[2] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[3] the run's lock: `.agent-runner/runs/<id>.lock` at the repository root, holding the pid of the one process of the run at work on it; a pid that is not a live process holds nothing (`run-lock.ts`).
[4] the tool's mark: `caller.runner` on a card: the machine that started the run, the run's process on that machine while it runs, and the follow-up's prompt when the run names one (`records.ts`).

## Business logic — TL;DR

- **Can a run start here** - the readiness check of the coding agent's own driver package: problems when its CLI is missing or logged out, warnings for running as root and, on Codex only, for skills in `~/.agents/skills` while this machine leaves `skills` out and for `memory` on while `skills` is off; only the coding agent's CLI is run, and for Codex this machine's `personal:` and `~/.agents/skills` are read; what the `check` command answers, and what a person's run and a scheduler's tick refuse on.
- **The detached run** - the run's lock [3] taken by the spawning process, then `agent-runner run <prompt> --id <id>`, with `--model <model>`, `--driver <name>` and `--then <prompt>` when the run has them, detached, stdin and stdout dropped, stderr to `.agent-runner/runs/<id>.stderr`, the run's id in its environment as `AGENT_ID`, and the lock handed to the spawned process; a spawn that fails lets the lock go.
- **A detached start on demand** - `run --detach <prompt>`: the run's lock taken, the marker written with the tool's mark [4] and the run's process spawned as above, the id answered at once, the lock let go when the marker or the spawn throws; the coding agent is Claude Code unless `--driver codex`, and the marker names it; a follow-up given with `--then` is on the marker's mark from the start and passed to the run's process.
- **A detached continuation on demand** - `run --detach --resume <id>`: the run's process spawned to continue it, its id answered at once; the line a dashboard's resume hook runs. A run the project has no record of is refused there and then.
- **A run in this process** - the id given or minted now, marked already when the id was given, on Claude Code or, with `--driver codex`, on Codex; a follow-up it names runs on the same coding agent, made for the follow-up's own id; a resumed run, and the follow-up its record names, on the coding agent its record names.
- **Either coding agent, unrestricted** - Claude Code with permissions bypassed, Codex with full access, `AGENT_ID` in the agent's environment: whichever coding agent runs, it pushes its branch and opens its pull request itself.
- **The person's own setup** - either coding agent starts with the three parts of the person's own setup, `memory`, `connectors` and `skills`, as when started by hand; each part is left out when this machine's `.agent-runner/config.yml` turns it off under `personal:`; the project's own instructions and skills always load; how a part is turned off is the coding agent's driver's business, and a part Codex cannot turn off is a warning before the run.
- **The model** - the one given, to either coding agent; none given, none is named, on the card or to the coding agent, which starts on its own default.

## Business logic

### Can a run start here

#### Context

**User story**: the user picks Claude Code or Codex in a dashboard's launcher, and a missing or logged-out CLI is said under the prompt box before the Start (the project's check hook runs `agent-runner check`).

**Problem**: a run on a coding agent whose CLI is missing or logged out takes a checkout and a marker, then dies before its first turn; the check costs about a second, the dead run a branch.

#### Business logic

The answer is the readiness check of the coding agent's own driver package (problems: its CLI not found, or not logged in; warnings: running as root, and, for Codex only, skills in `~/.agents/skills` while this machine leaves `skills` out, which Codex has no switch for, and `memory` on while `skills` is off, which brings nothing back), and nothing more: the project's git host is not probed, since a project with no git host package runs fine, and one whose git host cannot answer says so in the run's own log. For Codex it reads this machine's `personal:` to know whether `skills` is off, saying nothing about a broken config there (the run itself says it). A scheduler's tick asks it for Claude Code, the coding agent every scheduled run is on.

### The detached run

#### Context

**Problem**: a run must outlive whatever started it (a dashboard's start hook, a scheduler's tick), and a run that dies before it writes anything must leave a trace the sweep can read.

#### Business logic

The spawning process first takes the run's lock [3] with its own pid, waiting while another live process holds it, so that from before the run's process exists a sweep reads the run as held rather than gone. The run is the tool's own executable started as a detached process with `run <prompt> --id <id>`, then `--model <model>` when the run has a model, `--driver <name>` when it has a coding agent named and `--then <prompt>` when it names a follow-up (a person's detached start only; a scheduler's runs name none); each left out, the run's own default applies, the repository as its working directory, no stdin, stdout dropped, stderr appended to `.agent-runner/runs/<id>.stderr` (the directory made when missing), and the run's id as `AGENT_ID` in its environment. The spawning process waits only until the process has spawned; the lock is then handed to the spawned process's pid, which finds it its own when it takes it and holds it for the run's life. A spawn that fails lets the lock go and the error stands (a scheduler's tick reads it as `could not start: …`).

### A detached start on demand

#### Context

**User story**: the user presses Start on a dashboard, or types `agent-runner run --detach "/triage quick"`, and gets the run's id back at once while the agent works in its own process; the dashboard shows the run from its live record.

**Problem**: `run <prompt>` answers only when the agent has ended; a dashboard's start hook needs the id now, and must not hold a process for the run's whole life.

#### Business logic

`run --detach <prompt>` mints the id from the clock, takes the coding agent from `--driver` (Claude Code when absent) and the model by the rule below, takes the run's lock [3] with its own pid before anything is written, so that a scheduler's sweep reading the marker before the run's process has its checkout sees the run held, writes the marker [2] on the branch, naming the coding agent and the model when there is one, with the tool's mark [4] naming this host and, when `--then` was given, the follow-up's prompt (no pid: the process does not exist yet, and the lock is what says the run lives; a marker that could not even be committed is logged as `[agent-runner] the run's record could not be written: …`), spawns the run's process as above, handing it the lock, with the id, the prompt, the coding agent, the model when there is one, and the follow-up, and answers the id, the driver and, when the run has one, the model. When the marker's write or the spawn throws, the lock is let go and the error stands. The run's process, given its id, does not mark itself again.

Continuing an ended run has the same shape: `run --detach --resume <id>`, with the user's text or their `--answer`, and `--model` when given, spawns the run's process as `run --resume <id>` with the text as its argument, or `--answer <label>`, and `--model <model>` when given, and answers the run's id at once — what a dashboard's resume hook runs, for the same reason its start hook runs the detached start. No lock is taken here: the resumed run's process takes it and waits for it (`run.ts`). One thing is decided before anything is spawned: a run this project has no record of is refused, `no run <id> in this project`, while someone is still listening, since everything after the spawn is the resumed run's own record and nobody would read a failure there. The run's process does the rest — the checkout it kept or a fresh one on its branch, the session resumed, the diary continued.

### A run in this process

#### Context

See `run.ts`.

#### Business logic

A run given an id (a detached start's process, or a scheduler's) comes with its marker already on the branch, so it does not mark itself. A person's run (`agent-runner run <prompt>`) mints its id from now and marks itself. The coding agent is Claude Code through `@agent-driver/claude`, or Codex through `@agent-driver/codex` when `--driver codex` was given. A run that names a follow-up (`run --then`, `run.ts`) runs it on the same coding agent, a driver made for the follow-up's own id, so its `AGENT_ID` is its own. A resumed run (`run --resume`) is on the coding agent its record names (Claude Code when the record names none), because the session it resumes is that coding agent's, and so is the follow-up its record names; a record naming one this package cannot start is refused, `run <id> is on <name>, which agent-runner cannot start`.

### Either coding agent, unrestricted

#### Context

**User story**: the user picks Claude Code or Codex for a run, on the command line or in a dashboard's launcher, and gets the same thing from either: the agent does the work, pushes its branch and opens its pull request.

**Problem**: Codex's default sandbox lets the agent write in its checkout only, which is enough when something outside the sandbox publishes the work. Here nothing does: the agent publishes itself.

#### Business logic

Claude Code is started with permissions bypassed (an unattended run can answer no prompt). Codex is started with full access instead of its default sandbox. Both get the run's id as `AGENT_ID` in their environment, which the tickets skill reads as the claiming agent's id. `agent-driver`'s own default for Codex stays the workspace-only sandbox; only `agent-runner` passes the wider setting.

### The person's own setup

#### Context

**User story**: a user's run behaves like the coding agent they start by hand, with their memory, connectors and skills, so the tool holds no surprise. A user who wants their scheduled `/work-queue` to do the same job on their laptop as on a teammate's machine, on Claude Code or on Codex, without quoting their memory, trying their Gmail or Slack connector, or reaching for a skill only they have, writes each part's line under `personal:` in `.agent-runner/config.yml` there (`memory: off`).

**Problem**: a coding agent started by hand loads the person's own setup on top of the project's. Claude Code loads its auto-memory, the connectors of the claude.ai account, the user settings with the skills synced from that account, `~/.claude/CLAUDE.md` and `~/.claude/skills`. Codex loads the apps and plugins of the ChatGPT account, `~/.codex/AGENTS.md`, `~/.codex/skills` and `~/.codex/config.toml`, and its memories when that feature is on. A run started on one machine can then do a different job than the same prompt on another, which is the person's to turn off.

#### Business logic

Each run, and each resume, reads `personal:` from `.agent-runner/config.yml` (`config.ts`) before it makes its coding agent, and what is wrong in it goes to the run's log (stderr on the command line, which for a detached run is its `.agent-runner/runs/<id>.stderr`; nowhere when a program calls without a log); a follow-up gets the same reading. A resume reads it again, so a run resumed after the file changed continues with the new parts. The three parts go as they are to the coding agent's driver, which turns each part that is off into its own switches; this tool knows none of them:

- Claude Code (`@agent-driver/claude`): `memory` off drops the auto-memory, `connectors` off the claude.ai connectors, `skills` off the user settings, which carry the skills synced from the claude.ai account, `~/.claude/CLAUDE.md` and `~/.claude/skills`, and also the personal effort level, model and hooks. A person who logs in through their user settings (an `apiKeyHelper`, or an `env` entry such as `ANTHROPIC_API_KEY`) needs `skills` on; the readiness check asks Claude Code with the person's whole setup, so it does not catch that.
- Codex (`@agent-driver/codex`): `memory` off drops Codex's memories, `connectors` off Codex's apps and plugins, `skills` off runs Codex from a Codex home of its own (which also keeps Codex's memories out, so `memory` on needs `skills` on too, and the readiness check says so), one per machine for every project, that starts with only a link to the person's login, so `~/.codex/AGENTS.md`, `~/.codex/skills` and `~/.codex/config.toml` stay out; a person who sets their model provider or login in that `config.toml`, or keeps their login outside `auth.json`, needs `skills` on; the readiness check asks Codex in the person's own home, so it does not catch that. Codex keeps its conversations in that home, so a run started with `skills` off is resumed from it; a run resumed after `skills` changed does not find its conversation. Skills in `~/.agents/skills` load whatever the parts say: Codex has no switch for that folder, and the readiness check warns while it holds skills.

The project's own instructions (`CLAUDE.md`, `AGENTS.md`), its skills, and each coding agent's built-in skills load whatever the parts say.

### The model

#### Context

**Problem**: the tool keeps no state, so it has no model of its own to fall back on; a model named for the wrong coding agent (a Claude model handed to Codex) would fail the run at its start.

#### Business logic

A model given with `--model` is passed to either coding agent and written on the card. With none given, the run names no model, on its card and to the coding agent, which starts on its own default: a dashboard's Start with no model picked is such a run. A scheduler names its own model (`agent-scheduler model <id>`, `opus` by default) on every run it starts. A resumed run takes the given model, else the one its record carries, else none.
