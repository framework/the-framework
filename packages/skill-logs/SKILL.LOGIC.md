The instructions the `logs` skill gives an agent [1], as business logic: where the record of every run [2] lives, how to read it with the `logs` command, and when to look back before working.

## Context

**User story**: an agent about to plan or work a ticket learns what earlier agents did on it: a run that stopped or failed tells it what to avoid, and a run that finished with a pull request tells it the work may already be there, so the same work is not done twice and the same mistake not made twice.

**Business logic story**: the daemon hands the coding agent this skill by its name, `logs`, and puts the `logs` command on the agent's PATH; the command's rules are in `src/cli.ts`, the record's shapes in `src/run.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] card: the run's `<id>.json`: what was asked, the ticket, the branch, the pull request, how it ended, what it cost.
[6] diary: the run's `<id>.jsonl`: what the agent said.
[7] queue entry: an item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[8] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[9] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Where the record lives** - every run is two files under `agents/<who>/` on the `agent-data` branch, never on a code branch and not in the agent's checkout.
- **How to read it** - the `logs` command, a dependency of the repository, run as `npx logs` after installing with the lockfile's package manager; it only reads, refuses with exit 1 and a line on stderr, and answers a wrong command line with the usage and exit 2.
- **The two reads** - the list of cards newest first, the newest 20 unless `--limit` says otherwise, narrowed by `--ticket` or `--branch`; and `show <id>` for one run with what the agent said.
- **Before planning or working a ticket, read its runs** - `npx logs --ticket <file>`: a `stopped` or `failed` run says what to avoid, a `done` run with a `pr` says to read the pull request before doing the work again, and a run with no ticket is found by `--branch` or in the list.
- **The card** - the fields and their meaning, the four statuses, cost in US dollars, absent when unknown; `caller` is the writing program's and never printed.
- **The diary** - four kinds of line in the order they happened; any other kind is left out of `show`.

## Business logic

### Where the record lives

#### Context

See `## Context`.

#### Business logic

The agent [1] is told that every run [2] an agent made on the project leaves a record on the branch `agent-data` [3], never on a code branch, so that its own checkout [4] does not contain it. A run is two files under `agents/<who>/`: the card [5], `<id>.json`, with what was asked, the ticket, the branch, the pull request, how it ended and what it cost; and the diary [6], `<id>.jsonl`, with what the agent said along the way and its result.

### How to read it

#### Context

See `## Context`.

#### Business logic

The agent [1] reads the record with the `logs` command, a dependency of the repository (`@gemstack/skill-logs`): with no `node_modules` it installs first with the lockfile's package manager (`npm install` for a `package-lock.json`), then runs `npx logs`. The agent is told that the command only reads, since the program that ran an agent records its run [2] at its end; that a refusal exits 1 with a line on stderr; and that a wrong command line exits 2 with the usage.

### The two reads

#### Context

See `## Context`.

#### Business logic

The agent [1] is given two command lines. `npx logs [--ticket <file>] [--branch <name>] [--limit N]` lists the runs [2] newest first as one JSON array of cards [5], the newest 20 unless `--limit` says otherwise; `--ticket` keeps the runs that worked one ticket, named by its file name or by the path a queue entry [7] links to; `--branch` keeps the runs on one branch. `npx logs show <id>` prints one run: its card plus `diary`, the lines of what the agent said, its result, how it ended and what it cost.

### Before planning or working a ticket, read its runs

#### Context

**Problem**: outside the program that records runs, nobody would ever read the logs unless the skill itself says when to look back.

#### Business logic

Before planning or working a ticket, the agent [1] runs `npx logs --ticket <file>`, because the ticket, or a queue entry [7] that links one, may have been worked before. What it concludes: a `stopped` or `failed` run [2] tells what to avoid, and `npx logs show <id>` gives what that agent said before it ended; a `done` run with a `pr` means the work may already be there, and the agent reads the pull request before doing it again; a run with no ticket is found with `--branch`, or in the list.

### The card

#### Context

See `## Context`.

#### Business logic

The agent [1] is shown a card [5] and told its fields: `id`; `startedAt` and `endedAt`; `status`, one of `running`, `done`, `stopped` or `failed`; `intent`, what the agent was asked to do; `driver` [8] and `model`; `branch`; `pr`, a number and a URL; `ticket`, a path; and `cost`, in US dollars. Every field but `id`, `startedAt` and `status` is absent when unknown. The program that wrote the card may keep its own bookkeeping under one more key, `caller`, which the command never prints.

### The diary

#### Context

See `## Context`.

#### Business logic

The diary [6] is one JSON object per line. Four kinds are the agent's [1], in the order they happened: `said`, something the agent said; `result`, the agent's final answer for a turn [9]; `cost`, what a stretch of the run [2] cost, in US dollars; and `ended`, how the run ended, with a detail when it did not end well. Any other kind of line is the writing program's own, and `show` leaves it out.
