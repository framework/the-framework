The `logs` skill's implementation: what a run [1] is (a card [2] and a diary [3] under `agents/<who>/` on the `agent-data` branch [4]), the recording program's [5] store that records, patches, deletes and lists runs through the branch's checkout [6], and the `logs` command that reads them off origin for an agent [7]. `bin-dir.ts` tells a program that starts agents where the executable and `SKILL.md` are.

## Context

**User story**: when an agent [7] ends, its run is on the branch and pushed; from then on every agent's `npx logs`, on any machine or in a cloud session, and the user's dashboard pages read the same record.

## Glossary

[1] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[2] card: the run's `<id>.json`: what was asked, the ticket, the branch, the pull request, how it ended, what it cost.
[3] diary: the run's `<id>.jsonl`: what the agent said.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[5] recording program: the program that ran an agent and records its run when the agent ends; in the product, the daemon.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The one name** (`names.ts`) - `agents`, the directory at the branch root the runs live under; importable from browser code.
- **What a run is** (`run.ts`) - the card's eleven fields and the recording program's `caller`; the four statuses; a run id as a safe file name; a person's directory from a git email; how a card and a diary are written and read back; the four kinds of diary line that are the agent's; which run worked a ticket; newest first; the public card without `caller`.
- **Recording and reading runs for the recording program** (`store.ts`) - one commit per record, patch or delete, through the branch's write cycle; the runs listed newest first off the checkout; a run recorded again stays where it sits.
- **The `logs` command** (`cli.ts`) - the list with `--ticket`, `--branch` and `--limit` (20 by default), `show <id>` with the agent's diary lines, reads off origin's copy fetched once, the refusals `not-a-repo`, `no-run` and `git-failed`, and the exit codes 0, 1 and 2.
- **Where the skill is** (`bin-dir.ts`) - the executable's directory for an agent's PATH, the skill's name `logs`, and the package directory holding `SKILL.md`.
- **The entry point** (`index.ts`) - what the product imports, plus a `names` entry point for browser code.
- **The tests** (`run.test.ts`, `store.test.ts`, `cli.test.ts`) - the shapes and their safety rules; recording, listing, patching and deleting against a real repository; the command's replies, refusals and exit codes from an agent's clone.
