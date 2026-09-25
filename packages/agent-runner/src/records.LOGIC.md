A run in flight is a run record [1]: the `logs` skill's card on the project's `agent-data` branch [2], written before the agent is spawned with `status: running` and the tool's mark [3] under `caller`, and written again when the run ends, same id, same file, with how it went. One file for the run's whole life, and every machine that shares the branch reads the same running cards: a scheduler counts them against a command's cap [4]. No pid is held anywhere: a restart loses nothing.

## Context

**User story**: the dashboard's runs list shows a run as `running` from the moment it was started, whichever machine started it, and as `done` or `failed` with its pull request when it ends; two of the user's machines running the same schedule see the same runs in flight.

**Business logic story**: the card's shape, the runs directory on the branch, and the write as one pushed commit are the `logs` package's rules; this file only says what a marker is and what the tool's mark holds. Which command of a schedule a run counts for is the scheduler's to decide (`agent-scheduler`'s `records.ts`), off the prompt the card carries: the mark names no command. A running card from another machine is that machine's: only its own sweep, or a person, changes it. A machine that never comes back leaves its card running, on purpose: nothing here guesses that a run it cannot see is dead.

## Glossary

[1] run record: the `logs` skill's record of a run on the `agent-data` branch: a card (`<id>.json`) and a diary (`<id>.jsonl`). Written twice, over the same file: as a marker before the agent exists, and with how it went when the run ends.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] the tool's mark: `caller.runner` on a card: `host`, the machine that started it; `pid`, the run's process on that machine while it runs, when known; `then`, the follow-up's prompt, when the run names one (`run --then`: once the run ends done with a pull request, a fresh run on its branch gets that prompt and the run's id, `run.ts`).
[4] cap: how many runs of one scheduled command may be in flight at once, across every machine that shares the repository.
[5] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.

## Business logic — TL;DR

- **The marker** - a card with the run's id, its start time, `status: running`, the prompt as the intent, the driver, the model when the run has one and the tool's mark, written to the branch with an empty diary; the write says whether it reached origin.
- **Reading the mark** - a card carries the tool's mark when `caller.runner` is an object with a `host` string; `pid` is kept only when it is a number and `then` only when it is a string; a card without it is somebody else's run.
- **Withdrawing** - a marker whose scheduler lost the cap is deleted from the branch, so no record says running for a run that never was.
- **The record at the end** - the card and the diary written over the marker, same id, same file; the mark stays on the card.

## Business logic

### The marker

#### Context

See `## Context`.

#### Business logic

Before a run's process exists, or as the first thing a person's run does, its card is written to the `agent-data` branch [2] by the `logs` package: the run's id, its start time, `status: running`, the prompt as what was asked, the driver's id, the model when the run has one, and the tool's mark [3] under `caller.runner`, with an empty diary. The write is one commit pushed straight to the branch, and its outcome says whether the commit reached origin: only a pushed marker is one another machine can see.

### Reading the mark

#### Context

**Problem**: the branch holds runs other programs recorded too (a dashboard's own run, for instance); only the ones this tool started are its to sweep, resume or count.

#### Business logic

A card carries the tool's mark when `caller.runner` is an object whose `host` is a string. A card with no such object, or a mark with no `host` string, is somebody else's run. Reading a mark keeps `pid` only when it is a number and `then` only when it is a string.

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
