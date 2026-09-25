The instructions the `logs` skill gives an agent [1], as business logic: where the record of every run [2] lives, how to read it with the `logs` command, and when to look back before working.

## Context

**User story**: an agent about to plan or work a ticket learns what earlier agents did on it: a run that stopped or failed tells it what to avoid, and a run that finished with a pull request tells it the work may already be there, so the same work is not done twice and the same mistake not made twice.

**Business logic story**: the coding agent finds this skill by its name, `logs`, where its harness looks for skills, and runs the command through `npx logs`; the command's rules are in `src/cli.ts`, the record's shapes in `src/run.ts`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] card: the run's `<id>.json`: what was asked, the branch, the pull request, how it ended, what it cost.
[6] diary: the run's `<id>.jsonl`: what the agent said.
[7] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[8] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Where the record lives** - every run is two files under `agents/<who>/` on the `agent-data` branch, never on a code branch and not in the agent's checkout.
- **How to read it** - the `logs` command, a dependency of the repository, run as `npx logs`, installing with the lockfile's package manager and running again when it fails for a missing `node_modules`; the agent only reads (the command's dashboard verbs are not its own); it refuses with exit 1 and a line on stderr, and answers a wrong command line with the usage and exit 2.
- **The two reads** - the list of cards newest first, the newest 20 unless `--limit` says otherwise, narrowed by `--branch`; and `show <id>` for one run with what the agent said.
- **Before planning or working a ticket, read its earlier runs** - claiming the ticket names who claimed it before, each a run's id, shaped like `2026-09-08T18-14-30-111Z`, read with `npx logs show <id>`, or else a branch, read with `npx logs --branch <name>`, where no run means no record and the agent reads the branch itself: a `stopped` or `failed` run says what to avoid, a `done` run with a `pr` says to read the pull request before doing the work again.
- **The card** - the fields and their meaning, the five statuses, cost in US dollars, absent when unknown; `caller` is the writing program's and never printed.
- **The diary** - four kinds of line in the order they happened, each possibly carrying `at`, the time it was written; any other kind is left out of `show`.

## Business logic

### Where the record lives

#### Context

See `## Context`.

#### Business logic

The agent [1] is told that every run [2] an agent made on the project leaves a record on the branch `agent-data` [3], never on a code branch, so that its own checkout [4] does not contain it. A run is two files under `agents/<who>/`: the card [5], `<id>.json`, with what was asked, the branch, the pull request, how it ended and what it cost; and the diary [6], `<id>.jsonl`, with what the agent said along the way and its result.

### How to read it

#### Context

See `## Context`.

#### Business logic

The agent [1] reads the record with the `logs` command, a dependency of the repository (`@gemstack/skill-logs`): it runs `npx logs`, and when that fails for a missing `node_modules` it installs with the lockfile's package manager (`npm install` for a `package-lock.json`) and runs it again. The agent is told that it only reads, since the program that ran an agent records its run [2] at its end, and that the command's `delete` and `patch` and its `--local` and `--full` flags are for the dashboard that shows the runs, never for it; that a refusal exits 1 with a line on stderr; and that a wrong command line exits 2 with the usage.

### The two reads

#### Context

See `## Context`.

#### Business logic

The agent [1] is given two command lines. `npx logs [--branch <name>] [--limit N]` lists the runs [2] newest first as one JSON array of cards [5], the newest 20 unless `--limit` says otherwise; `--branch` keeps the runs on one branch. `npx logs show <id>` prints one run: its card plus `diary`, the lines of what the agent said, its result, how it ended and what it cost.

### Before planning or working a ticket, read its earlier runs

#### Context

**Problem**: outside the program that records runs, nobody would ever read the logs unless the skill itself says when to look back. The card [5] does not name the ticket its run worked: the agent chooses its ticket after the run has started. The ticket's claim does: every claim on it names its holder, and the claim's history keeps them all.

#### Business logic

The agent [1] is told that a ticket may have been worked before, and that claiming it names who claimed it before: each a run's [2] id, shaped like `2026-09-08T18-14-30-111Z`, which it reads with `npx logs show <id>`, or else a branch, which it reads with `npx logs --branch <name>`; no run on that branch means no record, and the agent reads the branch itself. What it concludes: a `stopped` or `failed` run tells what to avoid, and the agent reads what that agent said before it ended; a `done` run with a `pr` means the work may already be there, and the agent reads the pull request before doing it again.

### The card

#### Context

See `## Context`.

#### Business logic

The agent [1] is shown a card [5] and told its fields: `id`; `startedAt` and `endedAt`; `status`, one of `running`, `done`, `stopped`, `failed` or `waiting` (ended on a question the agent asked, until it is answered); `intent`, what the agent was asked to do; `driver` [7] and `model`; `branch`; `pr`, a number and a URL; and `cost`, in US dollars. Every field but `id`, `startedAt` and `status` is absent when unknown. The program that wrote the card may keep its own bookkeeping under one more key, `caller`, which the command never prints to it.

### The diary

#### Context

See `## Context`.

#### Business logic

The diary [6] is one JSON object per line. Four kinds are the agent's [1], in the order they happened: `said`, something the agent said; `result`, the agent's final answer for a turn [8]; `cost`, what a stretch of the run [2] cost, in US dollars; and `ended`, how the run ended, with a detail when it did not end well. Each line may also carry `at`, the time it was written, in the same format as the card's times. Any other kind of line is the writing program's own, and `show` leaves it out.
