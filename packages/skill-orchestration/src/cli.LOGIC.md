The `orchestration` command: the command lines a main agent [1] runs to start a subagent [2], list its subagents, read one's result and stop one. Each call is short and answers one JSON document on stdout, a line for a person on stderr when there is something to say, and an exit code that says how it went: 0 for a result, 1 for a refusal or a failure, 2 for a command line that could not be read. The same contract as the other skills' commands and the runner's.

## Context

**User story**: an agent splitting its task runs `orchestration start "<task>"` for each part and ends its turn; when it is told one ended it runs `orchestration read <id>` or `list`, and `orchestration stop <id>` for one it no longer needs.

**Business logic story**: what each command does, and every refusal about runs, is `subagents.ts`'s; this file is the command line and the contract around it. Every command acts on the project the working directory belongs to, found by the `branches` package even from inside a checkout under `.branches/`.

## Glossary

[1] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[2] subagent: a run started for a main agent: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.

## Business logic — TL;DR

- **The contract** - one JSON document on stdout per command that ran; a refusal exits 1 with `{"ok":false,"reason":…}` and one line on stderr; a failure exits 1 with `{"ok":false,"reason":"failed","detail":…}` and the detail on stderr; no command, an unknown one, an unknown flag or a wrong number of arguments exits 2 with the usage on stderr and nothing on stdout.
- **The project** - found from the working directory, from inside a checkout too; outside a git repository every command refuses `not-a-repo`, `not inside a git repository`.
- **`start <task> [--model <id>] [--driver <claude-code|codex>]`** - exactly one argument; a task of white space only, or a driver that is neither name, is a usage error; otherwise the subagent is started and answered `{"ok":true,"id":…,"driver":…,"base":…}`, with `model` when one was named and `uncommitted: true` when the caller's checkout holds uncommitted changes, which also puts `your checkout has uncommitted changes: the subagent does not have them` on stderr.
- **`list`** - no argument; the caller's subagents as one JSON array, newest first, empty when it has none.
- **`read <id>`** - exactly one argument; the subagent's card with `ok: true`, and `result` once it has one.
- **The usage text** - the four command lines, and that a refusal or a failure exits 1 with `reason` in the JSON and why on stderr, a usage error 2.
- **`stop <id>`** - exactly one argument; `{"ok":true,"id":…}` once the signal is sent.
- **What the command runs with** - this machine's name, the clock, the probe of a live pid, SIGTERM as the stop, and the runner's readiness check, its writing and taking back of a run's first record, and its detached spawn of a run's process; a caller (the tests) may replace each.
