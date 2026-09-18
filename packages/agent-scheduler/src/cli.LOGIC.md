The command line, `agent-scheduler <command>`: JSON on stdout, one line for a person on stderr, and the exit code says how it went, 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read. The same contract as the skills' commands, so a person and a dashboard read it the same way. Seven commands: `tick`, `run <prompt> [--model <id>] [--driver <claude-code|codex>]`, `start [--keep-alive]`, `stop [--unless-keep-alive]`, `status`, `model <id>`, `offset <points>`.

## Context

**User story**: the user turns the scheduler on and off, reads its state, sets the model and the spend cushion for their machine, ticks once by hand, or starts one run by hand, all from any directory of the project, and a dashboard runs the same commands and parses the same JSON.

**Business logic story**: every command acts on the project the working directory belongs to, found by the `branches` package even from inside a checkout under `.branches/`. What each command does is `scheduler.ts`'s and `state.ts`'s; this file is the contract around them.

## Glossary

[1] the state: `.agent-scheduler/state.json` at the repository root, per user: on or off, keep-alive, the model, the spend cushion, the scheduler's pid, the last tick's decisions.
[2] tick: one pass of the scheduler: pull the `agent-data` branch, sweep, then one decision per scheduled command.
[3] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.

## Business logic — TL;DR

- **The contract** - one JSON document on stdout per command that ran, `ok` on every object; a refusal exits 1 with `{"ok":false,"reason":…}` and one line on stderr; a failure exits 1 with `{"ok":false,"reason":"failed","detail":…}` and the detail on stderr; a command line that cannot be read exits 2 with the usage on stderr and nothing on stdout.
- **The project** - found from the working directory, from inside a checkout too; outside a git repository every command refuses `not-a-repo`, `not inside a git repository`.
- **`tick`** - one tick of the project now, its decisions told on stderr, its record answered with `ok: true`.
- **`run <prompt>`** - one run now, in this process (or, with `--detach`, in its own process, answered at once with `id`, `command`, `driver`, `model` when the run has one, and `detached: true`), `--id`, `--command`, `--model` and `--driver` optional (the tick passes the first two), the outcome answered with `ok` true when the run is `done` or `waiting`; `run --resume <id> [<text>] [--answer <label>]` continues an ended run with the text as its next prompt or the answer to the question it ended on, one of the two required; with `--detach` the continuation runs in its own process and the run's id is answered at once, and a run this project has no record of is refused before anything is spawned.
- **`start`, `stop`, `status`** - the state answered after each; `start --foreground` makes this process the scheduler's; `start --keep-alive` writes keep-alive on; `stop --unless-keep-alive` leaves a keep-alive scheduler running, says so on stderr, and answers `kept: true`.
- **`model <id>`, `offset <points>`** - the state's model or spend cushion written for this user and the state answered; `offset` with something that is not a number is a usage error, `<value> is not a number of percentage points`.

## Business logic

### The contract

#### Context

**Problem**: the same output is read by a program parsing it (a dashboard, a hook) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

A command that ran prints exactly one JSON document on stdout, an object with `ok`, and exits 0. A refusal, a rule saying no (the working directory is not inside a repository), prints `{"ok":false,"reason":…}` on stdout, one line on stderr, and exits 1. Anything else that fails (git, the file system, a driver) prints `{"ok":false,"reason":"failed","detail":<the error's message>}` on stdout, the detail on stderr, and exits 1. A command line that cannot be read is rejected before anything runs: no command or an unknown one prints the usage on stderr and exits 2; an unknown flag or the wrong number of arguments (`run`, `model` and `offset` take exactly one, the others none) prints what was wrong (`expected 1 argument(s), got 0`) followed by the usage on stderr, nothing on stdout, and exits 2. The usage names the seven commands and the contract.

### The project

#### Context

See `## Context`.

#### Business logic

Every command first finds the project the working directory belongs to, by the `branches` package's rule, so a command run from inside a checkout under `.branches/`, or from a subdirectory, still acts on the project's root. Only git's own "not a git repository" is read as being outside a repository, refused as `not-a-repo` with `not inside a git repository`; every other git error stays the failure it is.

### `tick`

#### Context

See `tick.ts` and `scheduler.ts`.

#### Business logic

`tick` runs one tick [2] of the project now, the way the scheduler's process would, its lines told on stderr, and answers the tick's record (`at`, `decisions`, `note`) with `ok: true`. It runs whether or not the state is on: an off state answers the note `off` after the pull and the sweep.

### `run <prompt>`

#### Context

See `run.ts` and `scheduler.ts`.

#### Business logic

`run <prompt>` starts one run [3] of the prompt now, in this process, and answers when the agent has ended and the run is recorded: the outcome (id, status, branch, pull request, cost, whether the checkout was reclaimed, the detail of a failure) with `ok` true when the status is `done`. `--model <id>` picks the model over the state's; `--driver <claude-code|codex>` picks the coding agent, Claude Code when absent, any other name a usage error, and refused with `--resume` because a run continues on the coding agent its record names; `--id <id>` and `--command <name>` are what the tick passes to its spawned run, and a given id means the marker is already on the branch. With `--detach`, the run is started in its own process the way the tick starts one and the answer comes at once with the id (`--resume` and `--id` are a usage error with it). With `--resume <id>` and a text or `--answer <label>` (a usage error without either), the ended run is continued as the same run, its session resumed and its record reopened; the outcome is `ok` when it ends `done` or `waiting`.

### `start`, `stop`, `status`

#### Context

See `scheduler.ts`.

#### Business logic

`start` turns the scheduler on and answers the state [1] with the scheduler's pid; `--keep-alive` writes keep-alive on; `--foreground` runs the loop in this process, which is how the detached scheduler is started, and answers the state once stopped. `stop` turns it off, signals the scheduler's process, and answers the state with `kept: false`. `stop --unless-keep-alive` is the line a dashboard runs when it closes: when the state's keep-alive is on it changes nothing, prints `keep-alive is on, the scheduler keeps running` on stderr and answers the state as it is with `kept: true`; when keep-alive is off it is `stop`. `status` answers the state plus `running`.

### `model <id>`, `offset <points>`

#### Context

See `## Context`.

#### Business logic

`model <id>` writes the model every run of this user starts on and answers the state. `offset <points>` writes how far past the spend boundary a run may still start, in percentage points, and answers the state; a value that is not a finite number is a usage error, `<value> is not a number of percentage points`, exit 2.
