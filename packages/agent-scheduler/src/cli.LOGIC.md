The command line, `agent-scheduler <command>`: JSON on stdout, one line for a person on stderr, and the exit code says how it went, 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read. The same contract as the skills' commands, so a person and a dashboard read it the same way. Eight commands: `tick`, `init`, `start [--keep-alive]`, `stop [--unless-keep-alive]`, `status`, `model <id>`, `offset <points>`, `switch <command> <on|off>`.

## Context

**User story**: the user runs `init` once so the dashboard opens and closes the scheduler and reaches its spend cushion and schedule switches, turns the scheduler on and off, reads its state, sets the model and the spend cushion for their machine, switches a scheduled command on or off for their machine, or ticks once by hand, all from any directory of the project, and a dashboard runs the same commands and parses the same JSON. Running, continuing and checking one run are `agent-runner`'s commands, not this tool's.

**Business logic story**: every command acts on the project the working directory belongs to, found by the `branches` package even from inside a checkout under `.branches/`. What each command does is `scheduler.ts`'s and `state.ts`'s; this file is the contract around them.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, this machine's schedule switches [3], the scheduler's pid, the last tick's decisions.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command.
[3] schedule switch: a person's choice, on one machine, whether a scheduled command runs there; kept in the state, not in the schedule (`agent-schedule.md`). The schedule line is the default where nobody switched the command: on, unless the line says `off`.

## Business logic — TL;DR

- **The contract** - one JSON document on stdout per command that ran, `ok` on every object; a refusal exits 1 with `{"ok":false,"reason":…}` and one line on stderr; a failure exits 1 with `{"ok":false,"reason":"failed","detail":…}` and the detail on stderr; a command line that cannot be read exits 2 with the usage on stderr and nothing on stdout.
- **The project** - found from the working directory, from inside a checkout too; outside a git repository every command refuses `not-a-repo`, `not inside a git repository`.
- **`tick`** - one tick of the project now, each due command started as a run of `agent-runner`, its decisions told on stderr, its record answered with `ok: true`.
- **`init`** - this tool's lines written into the dashboard's hooks file, a line already there kept; answered with the file and which keys gained a line; refused `no-dashboard` where the project has no `.the-framework/` directory and `unreadable` where the file is not a YAML map (`init.ts`).
- **`start`, `stop`, `status`** - the state answered after each; `start --foreground` makes this process the scheduler's; `start --keep-alive` writes keep-alive on; `stop --unless-keep-alive` leaves a keep-alive scheduler running, says so on stderr, and answers `kept: true`.
- **`model <id>`, `offset <points>`** - the state's model (the one every scheduled run starts on) or spend cushion written for this user and the state answered; `offset` with something that is not a number is a usage error, `<value> is not a number of percentage points`.
- **`switch <command> <on|off>`** - this machine's schedule switch [3] for one command of `agent-schedule.md`, named as its line names it (quoted when it holds a word after the folder: `switch "triage quick" on`), written and the state answered; refused `no-schedule` without the file and `not-scheduled` when it has no line for the command; a value neither `on` nor `off` is a usage error.

## Business logic

### The contract

#### Context

**Problem**: the same output is read by a program parsing it (a dashboard, a hook) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

A command that ran prints exactly one JSON document on stdout, an object with `ok`, and exits 0. A refusal, a rule saying no (the working directory is not inside a repository), prints `{"ok":false,"reason":…}` on stdout, one line on stderr, and exits 1. Anything else that fails (git, the file system, a driver) prints `{"ok":false,"reason":"failed","detail":<the error's message>}` on stdout, the detail on stderr, and exits 1. A command line that cannot be read is rejected before anything runs: no command or an unknown one (`agent-runner`'s `run` and `check` among them) prints the usage on stderr and exits 2; an unknown flag or the wrong number of arguments (`model` and `offset` take exactly one, `switch` exactly two, the others none) prints what was wrong (`expected 1 argument(s), got 0`) followed by the usage on stderr, nothing on stdout, and exits 2. The usage names the eight commands and the contract.

### The project

#### Context

See `## Context`.

#### Business logic

Every command first finds the project the working directory belongs to, by the `branches` package's rule, so a command run from inside a checkout under `.branches/`, or from a subdirectory, still acts on the project's root. Only git's own "not a git repository" is read as being outside a repository, refused as `not-a-repo` with `not inside a git repository`; every other git error stays the failure it is.

### `tick`

#### Context

See `tick.ts` and `scheduler.ts`.

#### Business logic

`tick` runs one tick [2] of the project now, the way the scheduler's process would, a due command started as a run of `agent-runner`, its lines told on stderr, and answers the tick's record (`at`, `decisions`, `note`) with `ok: true`. It runs whether or not the state is on: an off state answers the note `off` after the pull and the sweep.

### `start`, `stop`, `status`

#### Context

See `scheduler.ts`.

#### Business logic

`start` turns the scheduler on and answers the state [1] with the scheduler's pid; `--keep-alive` writes keep-alive on; `--foreground` runs the loop in this process, which is how the detached scheduler is started, and answers the state once stopped. `stop` turns it off, signals the scheduler's process, and answers the state with `kept: false`. `stop --unless-keep-alive` is the line a dashboard runs when it closes: when the state's keep-alive is on it changes nothing, prints `keep-alive is on, the scheduler keeps running` on stderr and answers the state as it is with `kept: true`; when keep-alive is off it is `stop`. `status` answers the state plus `running`.

### `init`

#### Context

**User story**: the user runs `npx agent-scheduler init` in a project the dashboard knows; from then on the dashboard starts the project's scheduler when it opens and stops it when it closes, and its usage panel's handle and its schedule switches reach the scheduler's state. The Start's lines are `agent-runner init`'s.

#### Business logic

`init` takes no argument. It writes this tool's lines into the project's `.the-framework/hooks.yml`, keeping every line already there (`init.ts`), and answers `{"ok":true,"file":…,"added":[…],"kept":[…]}`. Where the project has no `.the-framework/` directory it refuses `{"ok":false,"reason":"no-dashboard","file":…}` with `no .the-framework/ here: add the project in the dashboard first` on stderr, exit 1; a file that is not YAML, or not a map, is refused `unreadable`, with the file and the parser's first line on stderr, exit 1.

### `model <id>`, `offset <points>`

#### Context

See `## Context`.

#### Business logic

`model <id>` writes the model every scheduled run of this user starts on and answers the state. `offset <points>` writes how far past the spend boundary a run may still start, in percentage points, and answers the state; a value that is not a finite number is a usage error, `<value> is not a number of percentage points`, exit 2.

### `switch <command> <on|off>`

#### Context

**User story**: the user wants the daily clean-up after merges, listed `off` in the tracked `agent-schedule.md`, to run on their own machine; they flip its schedule switch [3] in the dashboard's Settings page, whose project `switch` hook runs `npx agent-scheduler switch "$COMMAND" "$SWITCH"`, or type `agent-scheduler switch post-merge-cleanup on`; the tracked file does not change, and no other machine runs it.

#### Business logic

`switch` takes exactly two arguments: a command's name and `on` or `off`; any other value is a usage error, `<value> is neither on nor off`, exit 2. With no `agent-schedule.md` in the repository it refuses `{"ok":false,"reason":"no-schedule"}` with `no agent-schedule.md in this repository` on stderr, exit 1; when the schedule has no readable line for the command it refuses `{"ok":false,"reason":"not-scheduled","command":<name>}` with `agent-schedule.md has no line for <name>` on stderr, exit 1. Otherwise it writes this machine's schedule switch [3] for the command by `state.ts`'s rule (kept only where it differs from what the line says) and answers the state with `ok: true`.
