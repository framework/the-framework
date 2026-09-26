The command line, `agent-runner <command>`: JSON on stdout, one line for a person on stderr, and the exit code says how it went, 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read. The same contract as the skills' commands, so a person and a dashboard read it the same way. Three commands: `run <prompt> [--model <id>] [--driver <claude-code|codex>] [--then <prompt>]` (also `--detach`, `--resume <id>` and `--id <id>`), `check [--driver <claude-code|codex>]`, `init`.

## Context

**User story**: the user runs `init` once so the dashboard's Start, its answers to a run and its check before a Start run through this tool, asks whether a run can start on this machine, or starts or continues one run by hand, all from any directory of the project; a dashboard runs the same commands and parses the same JSON, and a scheduler spawns `run` with the id of the marker it wrote.

**Business logic story**: every command acts on the project the working directory belongs to, found by the `branches` package even from inside a checkout under `.branches/`. What each command does is `runner.ts`'s and `init.ts`'s; this file is the contract around them.

## Glossary

[1] run: one agent this tool starts: a process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.
[2] follow-up: the prompt a run names with `run --then`: once the run ends done with a pull request, a fresh run on the same branch is given that prompt followed by a space and the first run's id.

## Business logic — TL;DR

- **The contract** - one JSON document on stdout per command that ran, `ok` on every object; a refusal exits 1 with `{"ok":false,"reason":…}` and one line on stderr; a failure exits 1 with `{"ok":false,"reason":"failed","detail":…}` and the detail on stderr; a command line that cannot be read exits 2 with the usage on stderr and nothing on stdout.
- **The project** - found from the working directory, from inside a checkout too; outside a git repository every command refuses `not-a-repo`, `not inside a git repository`.
- **`run <prompt>`** - one run now, in this process (or, with `--detach`, in its own process, answered at once with `id`, `driver`, `model` when the run has one, and `detached: true`), `--id`, `--model`, `--driver` and `--then` optional (`--id` is what the spawner of a marked run passes; `--then` names a follow-up [2]: once the run ends done with a pull request, a fresh run on its branch gets that prompt and the run's id, and the merge waits for it), the outcome answered with `ok` true when the run is `done` or `waiting`; `run --resume <id> [<text>] [--answer <label>]` continues an ended run with the text as its next prompt or the answer to the question it ended on, one of the two required, `--driver`, `--id` and `--then` a usage error with it; with `--detach` the continuation runs in its own process and the run's id is answered at once, and a run this project has no record of is refused before anything is spawned; a person's run (neither `--resume` nor `--id`) whose coding agent cannot start is refused `not-ready` before anything is written. A run names no command: there is no `--command`.
- **`check`** - whether a run on the coding agent named (Claude Code when absent) can start on this machine: the problems and the warnings answered with `ok: true`.
- **`init`** - this tool's lines written into the dashboard's hooks file, a line already there kept; answered with the file and which keys gained a line; refused `no-dashboard` where the project has no `.the-framework/` directory and `unreadable` where the file is not a YAML map (`init.ts`).

## Business logic

### The contract

#### Context

**Problem**: the same output is read by a program parsing it (a dashboard, a hook) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

A command that ran prints exactly one JSON document on stdout, an object with `ok`, and exits 0. A refusal, a rule saying no (the working directory is not inside a repository, the coding agent cannot start), prints `{"ok":false,"reason":…}` on stdout, one line on stderr, and exits 1. Anything else that fails (git, the file system, a driver) prints `{"ok":false,"reason":"failed","detail":<the error's message>}` on stdout, the detail on stderr, and exits 1. A command line that cannot be read is rejected before anything runs: no command or an unknown one (the scheduler's `tick` or `status` among them) prints the usage on stderr and exits 2; an unknown flag or the wrong number of arguments (`run` takes at most one, `check` and `init` none) prints what was wrong (`expected 1 argument(s), got 0`) followed by the usage on stderr, nothing on stdout, and exits 2. The usage names the three commands, says that when a run ends waiting on a question, or ends done with a pull request it did not have, the `ended:` line in the project's `.agent-runner/config.yml` runs, if there is one, in the project's root, with `MESSAGE` (one line for a person), `RUN_ID`, `STATUS`, `QUESTION` and `PR_URL` in its environment, that a run's Claude Code leaves out the person's own setup and that, in the same file, each part comes back with its own line under `personal:` (`memory: on` for their auto-memory, `connectors: on` for their claude.ai connectors, `skills: on` for their user settings (effort, model, a login through `apiKeyHelper`), the skills synced from their claude.ai account, `~/.claude/CLAUDE.md` and `~/.claude/skills`), and that the file is this machine's, to keep out of git, which this tool does itself for `.agent-runner/` once a run has started here (`ended.ts`); and it states the contract.

### The project

#### Context

See `## Context`.

#### Business logic

Every command first finds the project the working directory belongs to, by the `branches` package's rule, so a command run from inside a checkout under `.branches/`, or from a subdirectory, still acts on the project's root. Only git's own "not a git repository" is read as being outside a repository, refused as `not-a-repo` with `not inside a git repository`; every other git error stays the failure it is.

### `run <prompt>`

#### Context

See `run.ts` and `runner.ts`.

#### Business logic

`run <prompt>` starts one run [1] of the prompt now, in this process, and answers when the agent has ended and the run is recorded: the outcome (id, status, branch, pull request, cost, whether the checkout was reclaimed, the detail of a failure) with `ok` true when the status is `done` or `waiting`. `--model <id>` names the model, the coding agent's own default when absent; `--driver <claude-code|codex>` picks the coding agent, Claude Code when absent, any other name a usage error, `unknown driver "<name>"; the drivers are claude-code and codex`, and refused with `--resume` because a run continues on the coding agent its record names; `--id <id>` is what the process spawning a marked run passes (a detached start, a scheduler's tick), and a given id means the marker is already on the branch. `--command` is an unknown flag, a usage error: a run carries no command, and a scheduler reads which of its commands a run counts for off the prompt. `--then <prompt>` names the run's follow-up [2] (`run.ts`): once the run ends done with a pull request, a fresh run on its branch gets that prompt, trimmed, followed by the run's id, and the run's merge is held until that one ends done; the outcome then carries the follow-up's outcome under `then`, with the release of the held merge under its `merge`. A `--then` that is empty or only spaces is a usage error, `--then needs a prompt`, exit 2, read before the readiness check below. With `--detach`, the run is started in its own process (`runner.ts`), its follow-up passed on, and the answer comes at once with the id (`--id` is a usage error with it). With `--resume <id>` and a text or `--answer <label>` (a usage error without either), the ended run is continued as the same run, its session resumed and its record reopened; `--id` is a usage error with it, since a run continues under its own id, and so is `--then` (`--resume takes no --then: a run continues with the follow-up its record names`); the outcome is `ok` when it ends `done` or `waiting`. With `--detach --resume <id>`, the continuation runs in its own process and the answer comes at once with the run's id and `detached: true`; a run this project has no record of is refused before anything is spawned.

A person's run, one given neither `--resume` nor `--id` (with or without `--detach`), first asks whether its coding agent can start on this machine (`readyToRun` in `runner.ts`), after the command line is read and before any marker, checkout or process: when the answer has a problem (the coding agent's CLI is missing or logged out), the run is refused with `{"ok":false,"reason":"not-ready","problems":[…],"warnings":[…]}` on stdout and the problems joined by a space on stderr, exit 1; so a dashboard's start hook shows the problem as its error. A spawned run given `--id` is not asked again, since whoever marked it asked before (a detached start here, a scheduler's tick before its marker), and a resumed run is not asked, since its coding agent already ran on this machine.

### `check`

#### Context

**User story**: the dashboard's launcher runs a project's check hook, `npx agent-runner check --driver "$DRIVER"`, when the user picks a coding agent, and says what would stop the run under the prompt box before the Start.

#### Business logic

`check` asks whether a run on the coding agent `--driver` names (Claude Code when absent; any other name a usage error, `unknown driver "<name>"; the drivers are claude-code and codex`, exit 2) can start on this machine, by `readyToRun` in `runner.ts`, and answers `{"ok":true,"problems":[…],"warnings":[…]}`, exit 0, whatever the lists hold: the command ran, and the answer is the lists. It takes no argument, and refuses `not-a-repo` outside a repository like every command.

### `init`

#### Context

**User story**: the user adds a project in the dashboard and its launcher says the project has no start hook; the user runs `npx agent-runner init` in the project, and Start works.

#### Business logic

`init` takes no argument. It writes this tool's lines into the project's `.the-framework/hooks.yml`, keeping every line already there (`init.ts`), and answers `{"ok":true,"file":…,"added":[…],"kept":[…]}`. Where the project has no `.the-framework/` directory it refuses `{"ok":false,"reason":"no-dashboard","file":…}` with `no .the-framework/ here: add the project in the dashboard first` on stderr, exit 1; a file that is not YAML, or not a map, is refused `unreadable`, with the file and the parser's first line on stderr, exit 1.
