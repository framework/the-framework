The recording program's [1] side of the runs [2]: reads and writes of `agents/<who>/<id>.json` (the card [3]) and `agents/<who>/<id>.jsonl` (the diary [4]) on the `agent-data` branch [5], off the branch's checkout [6] at `.branches/agent-data`, with every write going through that checkout's write cycle [7] so a run is committed and pushed the moment it lands. The command an agent runs never comes here: it reads the branch off origin instead (`cli.ts`), holding no checkout.

## Context

**User story**: an agent's [8] run is on the branch, pushed, the moment the agent ends, so the user opens its page from another machine, a wiped laptop loses nothing, and every later agent's `npx logs` sees it; the user's own branches never carry the record.

**Business logic story**: the daemon records a run when an agent ends, later patches the branch the work landed on and the pull request onto its card, deletes the run when it removes the agent's records, and lists runs and reads diaries for its pages; a run a dead daemon left marked `running` is recorded again, ended, by the next daemon that notices.

**Problem**: a run written but not committed would be swept into the next unrelated commit, or reset away, by the checkout's write cycle; a run recorded twice under two people would exist twice.

## Glossary

[1] recording program: the program that ran an agent and records its run when the agent ends; in the product, the daemon.
[2] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[3] card: the run's `<id>.json`: what was asked, the ticket, the branch, the pull request, how it ended, what it cost.
[4] diary: the run's `<id>.jsonl`: what the agent said.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[7] write cycle: one write to the branch through its persistent checkout: sync with origin, apply the change, commit, push; the change is re-applied when the push loses a race.
[8] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Where the runs are** - `agents/<who>/` inside the `agent-data` branch's checkout under `.branches/agent-data`; a run is found by looking through every person's directory for its card.
- **Listing every run** - every card in every person's directory, newest first; one that does not parse is skipped; a start time may filter; a missing directory means no runs.
- **Reading one run** - its card, its diary (empty for a run with no diary file), or its two file paths; none for a run that is not there.
- **Recording a run** - card and diary as one commit, "logs: record run <id>", under the directory of the person the repository commits as, or where the run already sits; an unsafe id is refused before anything is touched.
- **Patching the late facts** - the branch or the pull request onto the card, as one commit, "logs: patch run <id>"; true once committed even when the push is still owed; false for a run that is not there.
- **Deleting a run** - both files as one commit, "logs: delete run <id>"; a run that is not there is a landed no-op.

## Business logic

### Where the runs are

#### Context

See `## Context`.

#### Business logic

The runs [2] sit in `agents/` at the root of the `agent-data` branch [5], one directory per person, and for the recording program [1] that is `<project>/.branches/agent-data/agents/`, inside the branch's checkout [6]. A run is located by its id: the id must be a safe file name (the rule in `run.ts`), and each person's directory is searched for `<id>.json`; the diary [4] is the `<id>.jsonl` beside it. A run is nowhere when no directory has its card [3].

### Listing every run

#### Context

**User story**: the dashboard lists the project's past agents [8] from the branch, newest first.

#### Business logic

Every file named as a card [3] in every person's directory is read; a card that cannot be read or does not parse is skipped. When a start time is given, only the runs [2] whose `startedAt` is at or after it are kept, and a run whose `startedAt` cannot be read as a time is dropped by that filter. The result is ordered newest first by id. This never fails: a missing runs directory, or a project with no checkout [6] at all, is no runs.

### Reading one run

#### Context

See `## Context`.

#### Business logic

One run [2] is read off the checkout [6] by its id: its card [3], which is none when there is no such run or its card does not parse; its diary [4], every line of it including the recording program's [1] own, which is empty for a run with no diary file and none for a run that is not there; or the paths of its two files, none when the run is nowhere.

### Recording a run

#### Context

**Problem**: a run [2] ended by a later process than the one that started it must stay in one place, even when the two processes commit as different people.

#### Business logic

A run [2] is recorded as its card [3] and its diary [4], written together and committed as one commit with the message "logs: record run <id>", through the branch's write cycle [7]: committed the moment it lands, and pushed when the repository has a remote. An id that is not a safe file name is refused with the reason "not a run id: <id>" before anything is touched. The person's directory is derived from the git email the repository commits as (the rule in `run.ts`), read from the project's git configuration; when the email cannot be read the run is filed under `anonymous`. When the run already sits somewhere on the branch, its files are rewritten where they are, whichever person's directory that is: a run left marked `running` by a dead process and recorded again, ended, by another process stays in one place. Nothing is thrown: the write cycle's outcome says whether the commit landed and whether it was pushed.

### Patching the late facts

#### Context

**Business logic story**: the branch the work landed on and the pull request are known after the run's process is gone; the daemon patches them onto the card when it opens the pull request or adopts an agent's [8] cloud work.

#### Business logic

The branch or the pull request is patched onto a run's [2] card [3] by rewriting the card with the new value, as one commit with the message "logs: patch run <id>", through the branch's write cycle [7]. The result is true when the card now carries the fact and the commit landed, even when its push could not go out yet (the next cycle carries it); it is false when there is no such run, when its card does not parse, or when nothing could be committed.

### Deleting a run

#### Context

**Business logic story**: when the user removes an agent's [8] records, the run on the branch goes with them, as one committed and pushed change.

#### Business logic

A run [2] is deleted by removing its card [3] and its diary [4] as one commit with the message "logs: delete run <id>", through the branch's write cycle [7]; a missing diary does not stop the deletion of the card. A run that is not there is a landed no-op: nothing changes, nothing is committed, and the outcome reports success.
