A run in flight is a run record [1]: the `logs` skill's card on the project's `agent-data` branch [2], written before the agent is spawned with `status: running` and the tool's mark [3] under `caller`, and written again when the run ends, same id, same file, with how it went. One file for the run's whole life, and every machine that shares the branch reads the same running cards: a scheduler counts them against a command's cap [4]. No pid is held anywhere: a restart loses nothing.

## Context

**User story**: the dashboard's runs list shows a run as `running` from the moment it was started, whichever machine started it, and as `done` or `failed` with its pull request when it ends; two of the user's machines running the same schedule see the same runs in flight.

**Business logic story**: the card's shape, the runs directory on the branch, and the write as one pushed commit are the `logs` package's rules; this file only says what a marker is and what the tool's mark holds. Which command of a schedule a run counts for is the scheduler's to decide (`agent-scheduler`'s `records.ts`), off the prompt the card carries: the mark names no command. A running card from another machine is that machine's: only its own sweep, or a person, changes it. A machine that never comes back leaves its card running, on purpose: nothing here guesses that a run it cannot see is dead.

## Glossary

[1] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`). Written over the same file: as a marker before the agent exists, with how it went when the run ends, and once more without its branch when the reclaim deleted that branch.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] the tool's mark: `caller.runner` on a card: `host`, the machine that started it; `pid`, the run's process on that machine while it runs, when known; `then`, the follow-up's prompt, when the run names one (`run --then`: once the run ends done with a pull request, a fresh run on its branch gets that prompt and the run's id, `run.ts`); `publish`, the run's publish level [6], when it was given one (`run --publish`: the agent is told, in one sentence after its prompt, how far to publish when it finishes, `run.ts`); `parent`, the id of the run this one was started for, when it has one (`run --parent`: that run is told when this one ends, `parent.ts`); `base`, the branch this run's own branch started from, when one was named (`run --base`; origin's default branch otherwise); `baseCommit`, the commit the run's own branch was made at, for every run that makes its own branch, with a base named or not: the run's own work is what came after that commit (`run.ts`). A run given a branch that already exists has none.
[4] cap: how many runs of one scheduled command may be in flight at once, across every machine that shares the repository.
[5] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.
[6] publish level: how far a run's agent publishes its work when it finishes. There are three, each going further than the one before: `branch` (push the branch and open no pull request), `pr` (push the branch and open its pull request) and `merge` (push the branch and open its pull request, set to merge on its own once its checks pass). Any other word is no level. A run given none publishes only what its prompt asks.

## Business logic — TL;DR

- **The marker** - a card with the run's id, its start time, `status: running`, the prompt as the intent, the driver, the model when the run has one and the tool's mark, written to the branch with an empty diary; the mark's machine is also on the card as `caller.host`, and the mark's parent, when it names one, as `caller.parent`; the write says whether it reached origin.
- **What a reader finds beside the host** - the mark's parent and the mark's `baseCommit`, each when the mark has one, are on the card a second time, as `caller.parent` and `caller.baseCommit`, outside the mark, for a reader that does not know the mark.
- **Reading the mark** - a card carries the tool's mark when `caller.runner` is an object with a `host` string; `pid` is kept only when it is a number, `then`, `parent`, `base` and `baseCommit` each only when it is a string, and `publish` only when it is one of the three publish levels [6]; a card without it is somebody else's run.
- **What the reclaim is told** - the mark's `baseCommit`, when the mark has one, as the commit the run's branch was made at.
- **Withdrawing** - a marker whose scheduler lost the cap is deleted from the branch, so no record says running for a run that never was.
- **The record at the end** - the card and the diary written over the marker, same id, same file; the mark stays on the card.
- **A branch that is gone** - when the reclaim deleted the branch the card names, the record is written again without the branch.

## Business logic

### The marker

#### Context

See `## Context`.

#### Business logic

Before a run's process exists, or as the first thing a person's run does, its card is written to the `agent-data` branch [2] by the `logs` package: the run's id, its start time, `status: running`, the prompt as what was asked, the driver's id, the model when the run has one, and the tool's mark [3] under `caller.runner`, with the mark's machine also as `caller.host`, where a run's live card has it and where a dashboard tells this machine's runs from another's, with an empty diary. When the mark names a parent, the parent's id is on the card a second time, as `caller.parent`, beside `caller.host` and outside the mark, for the same reason: a reader of the card that does not know the tool's mark, such as a dashboard, finds there which run this one was started for. A run with no parent has no `caller.parent`. The write is one commit pushed straight to the branch, and its outcome says whether the commit reached origin: only a pushed marker is one another machine can see.

### What a reader finds beside the host

#### Context

**User story**: the dashboard shows a subagent under its main agent, and shows as a run's changes only what the run itself changed. It reads both facts off the card without knowing the tool's mark [3].

#### Business logic

Two of the mark's facts are written on the card a second time, beside `caller.host` and outside the mark, each only when the mark has it: the parent's id as `caller.parent`, and `baseCommit` as `caller.baseCommit`, the commit the run's own work begins at. The marker [5] carries the parent so. It carries no `baseCommit`: a marker is written before the run's checkout exists, so the commit is not known yet. The card a run starts with, and the card a resume writes, carry both (`run.ts`).

### Reading the mark

#### Context

**Problem**: the branch holds runs other programs recorded too (a dashboard's own run, for instance); only the ones this tool started are its to sweep, resume or count.

#### Business logic

A card carries the tool's mark when `caller.runner` is an object whose `host` is a string. A card with no such object, or a mark with no `host` string, is somebody else's run. Reading a mark keeps `pid` only when it is a number, `then`, `parent`, `base` and `baseCommit` each only when it is a string, and `publish` only when it is one of the three publish levels [6]: a word that is no level is dropped. Those five last for the run's whole life: a resume writes the mark again with its own host and pid and keeps them (`run.ts`). A resume replaces `baseCommit` in one case only: the run's branch was gone everywhere and was made again from the base, so the run's own work begins at the commit the base is at now (`run.ts`).

### What the reclaim is told

#### Context

**Problem**: the `branches` package deletes a branch with its checkout only when the branch holds nothing of its own. Without being told where the branch started, it can only ask whether origin's default branch already has everything on the branch. A run started from another branch (`run --base`) started somewhere else, and a project with no remote has no origin to ask: only the run's record says where its branch started.

#### Business logic

For a card whose mark names a `baseCommit`, the reclaim is told that commit as where the run's branch was made. A card with no mark, or a mark with none (a run given a branch that already existed), names nothing: the reclaim then only asks whether origin's default branch has everything on the branch.

### Withdrawing

#### Context

**Problem**: two machines can write a marker for the same scheduled command in the same minute; the one ranked past the cap must go, or the branch says two runs are running when one is.

#### Business logic

A marker [5] is withdrawn by deleting the run from the branch, the `logs` package's one-commit delete. After it, the run has no record at all.

### The record at the end

#### Context

See `## Context`.

#### Business logic

When the run ends, its card and its diary are written to the branch over the marker: the same id, so the same file, now with the status, the end time, the branch, the pull request and the cost, and the tool's mark still under `caller.runner`. The diary replaces the marker's empty one.

### A branch that is gone

#### Context

**Problem**: a run that changed nothing leaves a branch that holds nothing, and the reclaim deletes it with the checkout, after the record at the end was written. A record naming it points the user at a branch that no longer exists.

#### Business logic

Once the reclaim has deleted branches, the record is written again when one of them is the branch the card names: the same card and diary, without the branch. When the branch stayed, nothing is written. The record at the end is still written before the reclaim, so the record says the run ended while its checkout is still there.
