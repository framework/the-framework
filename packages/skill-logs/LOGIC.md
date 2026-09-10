The `logs` skill: the record of every run [1] agents [2] made on a project, kept on the `agent-data` branch [3] and never on a code branch, read by agents with the `logs` command. A run is two files under `agents/<who>/`: the card [4], `<id>.json`, and the diary [5], `<id>.jsonl`. Two callers meet the package: the command an agent runs, which only reads, off origin's copy of the branch from any clone; and the recording program [6] (the daemon), which keeps the branch checked out under `.branches/agent-data`, records each run through this package when the agent ends, patches the branch and the pull request onto it later, deletes it with the agent's records, and reads runs back for its pages. The package ships the executable (`bin/`), the library (`src/`) and `SKILL.md`, the agent's instructions. `package.json` and the `tsconfig*.json` files configure the build and carry no business logic; `DECISIONS.md` records the human decisions behind the package.

## Context

**User story**: an agent about to plan or work a ticket reads what earlier agents did on it and avoids repeating a failure or redoing work a pull request already holds; the user opens any past run's page from any machine and sees what was asked, where the work went, how it ended and what it cost, with what the agent said.

## Glossary

[1] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] card: the run's `<id>.json`: what was asked, the ticket, the branch, the pull request, how it ended, what it cost.
[5] diary: the run's `<id>.jsonl`: what the agent said.
[6] recording program: the program that ran an agent and records its run when the agent ends; in the product, the daemon.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - where the record lives, how to read it with `npx logs`, and the rule to read a ticket's runs before planning or working it: a `stopped` or `failed` run says what to avoid, a `done` run with a `pr` says to read the pull request first.
- **The record's shape** (`src/run.ts`) - the card's eleven fields, the four statuses, the recording program's own bookkeeping under `caller`, the diary's four kinds of line, a run id and a person's directory as safe file names.
- **Recording** (`src/store.ts`) - a run lands as one committed and pushed change through the `agent-data` branch's write cycle, under the person the repository commits as, or where it already sits; the branch and the pull request are patched on later, one commit each; a run is deleted as one commit.
- **The `logs` command** (`bin/`, `src/cli.ts`) - the list newest first with `--ticket`, `--branch` and `--limit` (20 by default), `show <id>` with the agent's diary lines, one JSON document per reply, the refusals `not-a-repo`, `no-run` and `git-failed` with exit 1, a wrong command line with exit 2.
- **Where the skill is found** (`src/bin-dir.ts`, `src/names.ts`, `src/index.ts`) - the executable's directory for an agent's PATH, the skill's name and directory for the coding agent, the runs directory name, and the entry points the product imports.
- **The tests** (`src/run.test.ts`, `src/store.test.ts`, `src/cli.test.ts`) - the shapes' safety rules, the store against a real repository, and the command's contract from an agent's clone.
