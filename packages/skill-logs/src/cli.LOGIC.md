The `logs` command line: the reads an agent [1] (or a person) makes in a shell, from any clone of the repository, over the runs [2] on the `agent-data` branch [3]; and, for a dashboard [9] that shows the runs, a read of this machine's copy, the whole record, a delete and a patch. An agent only reads: a run is recorded by the program that ran the agent, never by the agent. Every reply is one JSON document on stdout, a refusal adds one line on stderr, and the exit code says how it went: 0 for a result, 1 for a refusal or a git failure, 2 for a command line that could not be read.

## Context

**User story**: before planning or working a ticket, an agent [1] runs `npx logs show <id>` for each run its claim on the ticket names, and reads what that agent said before it ended; `npx logs` lists the latest runs newest first, `--branch` the runs on one branch. The agent sees only the record's own fields, never the daemon's bookkeeping.

**Business logic story**: the command opens the branch through the one-shot reader of `file-branch.ts`: one fetch from `origin`, then every read off origin's copy of the branch; without a remote, the local branch is read. The checkout [4] a daemon keeps under `.branches/agent-data` is never touched, and nothing lands in the clone: no local branch, no file.

**Business logic story**: a dashboard [9] reads the runs through this command rather than through the package's code, so any package that answers the same command line can take this one's place. The package says so in its `package.json` (`"framework": { "runs": "logs" }`). The dashboard polls, so it reads the checkout [4] kept on this machine, with no fetch; and it replays a run's whole diary [5] and needs the recording program's [6] `caller` key, so it asks for the whole record.

**Problem**: a list of every run, each with its prompt, is more than an agent should read for a look back; and a run's whole diary [5] is mostly the recording program's [6] bookkeeping, hundreds of kilobytes an agent cannot read.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[5] diary: the run's `<id>.jsonl`: what the agent said.
[6] recording program: the program that ran an agent and records its run when the agent ends; in the product, the scheduler (`agent-scheduler`).
[7] card: the run's `<id>.json`: what was asked, the branch, the pull request, how it ended, what it cost.
[8] queue entry: an item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[9] dashboard: a program that shows a project's runs to a person, such as The Framework's; it finds this command through the package's `framework.runs` declaration.

## Business logic — TL;DR

- **One JSON document, one exit code** - a result on stdout with exit 0; a refusal as `{ "ok": false, "reason": … }` on stdout plus one line on stderr with exit 1; a command line that could not be read as the usage on stderr, nothing on stdout, exit 2.
- **Read off origin, from anywhere in the repository** - the branch is fetched from `origin` once and every read goes to that copy; with no remote, the local branch; outside a repository, the refusal `not-a-repo`.
- **The bare command lists the runs** - newest first, the newest 20 unless `--limit` says otherwise, narrowed by `--branch <name>`, the skill's fields only.
- **`show <id>` prints one run** - its card and the agent's four kinds of diary line, never the recording program's; an id no run has is the refusal `no-run`.
- **For a dashboard: `--local` and `--full`** - with either read, `--local` reads the checkout kept at `.branches/agent-data` instead of fetching; `--full` prints the whole card, `caller` included, and for `show` every diary line.
- **For a dashboard: `delete <id>` and `patch <id>`** - remove a run, or set its branch and pull request, as one commit through the kept checkout, pushed; an id no run has is `no-run`, a write that did not land is `write-failed`.
- **A command line that cannot be read is rejected first** - an unknown command, a stray or missing argument, an unknown flag, a `--limit` that is not a whole number above 0, an id that is not one: the usage on stderr, exit 2.
- **Anything else that fails is `git-failed`** - reported with git's own reason on stderr and in the JSON, exit 1.

## Business logic

### One JSON document, one exit code

#### Context

See `## Context`.

#### Business logic

A command that runs prints exactly one JSON document on stdout and exits 0. A refusal, a rule saying no, prints `{ "ok": false, "reason": "<reason>" }` on stdout (with the run's [2] `id` added for `no-run`) so that a caller parsing the output learns why, prints one line for a person on stderr, and exits 1. A command line that could not be read prints the usage on stderr, nothing on stdout, and exits 2: the reason first when there is one ("not a run id: <id>", "expected 1 argument(s), got 2", "--limit takes a whole number above 0, got <value>"), the usage alone for an unknown command. The usage begins "usage: logs [command]" and ends "JSON on stdout. Exit code 1 for a refusal or a git failure (the reason on stderr), 2 for a usage error."

### Read off origin, from anywhere in the repository

#### Context

**Problem**: only origin has every writer's pushes; a clone's local copy of the branch, when it has one, trails them.

#### Business logic

The command first checks that it runs inside a git working tree; outside one it refuses with `not-a-repo` and the line "not inside a git repository". Only git's own "not a git repository" answer reads as that: a timeout, a missing git or a corrupt repository stays the failure it is. Then the branch is opened once through the one-shot reader in `file-branch.ts`: when the repository has an `origin` remote, the `agent-data` branch [3] is fetched from it once and every read goes to origin's copy; when it has none, the local branch is read. Nothing is fetched twice within one command, nothing is written to the clone, and the checkout [4] a daemon keeps is never touched.

### The bare command lists the runs

#### Context

**User story**: `npx logs`, `npx logs --branch <name>`, `npx logs --limit N`, alone or combined.

#### Business logic

With no command word, or a first word that is a `--` flag, the runs [2] are listed (off origin as above; `--local` changes where, below). Every run's id is taken from the directory listings alone: each person's directory under `agents/`, each file in it named `<id>.json` with a safe id (the rule in `run.ts`). The ids are ordered newest first, and the cards [7] are read one at a time until the cap is reached: the cards past the cap are never read. A card that does not parse is skipped. `--ticket <file>` keeps the runs whose card names that exact path or a path ending in `/<file>`, so a ticket's file name and the path a queue entry [8] links to both find it; `--branch <name>` keeps the runs whose card's branch is exactly that name; the cap counts the runs kept after the filters. The cap is 20 unless `--limit N` says otherwise. The reply is the JSON array of the cards, newest first, the skill's fields only: `caller` is printed only with `--full` (below). No runs at all is an empty array. A positional argument is a usage error.

### `show <id>` prints one run

#### Context

**User story**: `npx logs show <id>`, for what an agent [1] said before it ended.

#### Business logic

`show` takes exactly one argument, which must be a safe id (letters, digits, `-`, `_`); otherwise the command line is rejected with "not a run id: <id>". The run [2] is looked up across every person's directory; when no directory has its card [7], or the card does not parse, the command refuses with `no-run`, the id in the JSON, and the line "no run is named <id>". Otherwise, without `--full`, the reply is the card's public fields plus `diary`: the lines of the diary [5] that are the agent's four kinds (`said`, `result`, `cost`, `ended`, with any extra fields they carry), in order, and never the recording program's [6] other lines. A run with no diary file has an empty `diary`.

### For a dashboard: `--local` and `--full`

#### Context

See the business logic story in `## Context`. An agent is told in `SKILL.md` never to use them.

#### Business logic

Both flags go with the list and with `show`. `--local` reads the checkout [4] kept at `.branches/agent-data` under the repository's root, as it stands, without contacting `origin`: runs another machine pushed since that checkout last synced are not there, and a repository with no such checkout has no runs (`show` refuses `no-run`). The list filters and the cap apply the same way. `--full` prints the whole card, the recording program's [6] `caller` key included, and makes `show` print every diary line, the recording program's too, in order. Without the flags both reads behave as described above.

### For a dashboard: `delete <id>` and `patch <id>`

#### Context

**User story**: the person deletes a finished agent from the dashboard, or opens a pull request for it; the dashboard records both through this command.

#### Business logic

Both take exactly one safe id and write through the kept checkout's serialized write cycle (`store.ts`): synced first, the change applied, one commit, pushed. `delete <id>` removes the run's card and diary; `patch <id>` sets `--branch <name>`, and `--pr <number> --pr-url <link>` (always together, the number a whole number), at least one of the two. A run the synced checkout does not hold is the refusal `no-run`, and nothing is committed. A write that could not even be committed is the refusal `write-failed`, with the reason. A write whose push failed still succeeds: the commit is kept and rides the next cycle. The reply is `{ "ok": true, "id": "<id>" }`.

### A command line that cannot be read is rejected first

#### Context

See `## Context`.

#### Business logic

Before anything is read from git, the command line is checked. An unknown command word (anything but `show`, `delete`, `patch` or a leading `--` flag), a positional argument the command does not take, a missing one, an unknown flag, a flag without its value, a `--limit` that is not a whole number above 0, an id that is not a safe id, a `patch` with nothing to set, `--pr` without `--pr-url` or the other way round, or a `--pr` that is not a whole number, each print the usage on stderr, nothing on stdout, and exit 2.

### Anything else that fails is `git-failed`

#### Context

See `## Context`.

#### Business logic

Any failure a command throws that is neither a refusal nor a usage error, a git that failed or timed out for instance, is reported as `{ "ok": false, "reason": "git-failed", "detail": "<reason>" }` on stdout, the same detail on stderr, and exit 1; the detail is git's own `fatal:`, `error:` or `remote:` line when there is one (the rule in `git.ts`).
