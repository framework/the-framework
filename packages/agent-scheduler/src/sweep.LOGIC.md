The sweep [1]: what a run's [2] own process could not do because it died. Runs on every tick, before anything is decided, and only for this machine: a pid means nothing on another. A checkout [3] whose live log [4] says `running` under a dead pid is a run that died mid-work; a checkout whose live log says the run ended is one whose process died between the end and the record, or whose reclaim [5] could not push; a running card on the branch from this machine with no checkout behind it is a run that never started. A running record from another machine is never touched: no age-out, a person's pick.

## Context

**User story**: the user's laptop slept, or a run's process was killed; on the next tick the dashboard shows the run `failed` with what the agent had said until then, its checkout is gone or kept with a reason, and the command's cap is free again; a run on the user's other machine, which this machine cannot see, stays `running` until that machine's sweep or the user says otherwise.

**Business logic story**: the live log is the truth about a run this machine started, so checkouts are read first; the branch's cards are read second, for markers with nothing on disk. Recording and reclaiming are idempotent: a checkout kept once is recorded and reclaimed again on the next tick.

## Glossary

[1] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died, and only this machine's.
[2] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] live log: `agent.json` and `events.jsonl` under `.the-framework/` in a run's checkout, in the shape The Framework's dashboard reads; carries the run's pid, host and the tool's mark.
[5] reclaim: removing a finished agent's checkout once its work is on the remote.
[6] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.

## Business logic — TL;DR

- **Checkouts of this machine** - every checkout under `.branches/` whose live log is this tool's and names this host: `running` under a live pid is left alone; `running` under a dead pid is ended `failed` with `its process died before the run ended`; either way an ended log is recorded from its events and the checkout reclaimed, kept with the `branches` reason when it cannot go.
- **Markers of this machine with nothing behind them** - a running card marked by this host whose checkout the first pass did not see: left alone while its process is alive and its checkout not there yet (still booting), or while a checkout exists with no live log yet (the run is opening it); otherwise recorded `failed` with the last five lines of the spawn's stderr when there are any, else `stopped` as `its process is gone and left no checkout`.
- **Never another machine's** - a live log or a marker naming another host is that machine's.
- **What the sweep answers** - the runs it recorded with their status, the checkouts it reclaimed, and the ones it kept with why.

## Business logic

### Checkouts of this machine

#### Context

See `## Context`.

#### Business logic

For every checkout under `.branches/`, its live log's [4] meta is read; a checkout with none, or one that is not this tool's, or one naming another host, is skipped. A checkout whose meta says `running` and whose pid is alive on this machine is a run still working: skipped. One whose pid is dead is closed from outside: an `end` event, not ok, with the detail `its process died before the run ended`, appended to both files, the status now `failed` with the end time. Every checkout whose meta now says the run ended (closed just now, or ended by the run itself and never recorded, or recorded but kept) is recorded: the card from the meta (without a pull request: the sweep reads none back), the diary from the events file, written over the marker; then reclaimed under the `branches` rule with pushing allowed and the birth branch named. A reclaim that refuses keeps the checkout, and the sweep answers the reason (`dirty`, `not-on-remote: …`); the next tick tries again.

### Markers of this machine with nothing behind them

#### Context

**Problem**: the tick writes the marker [6] before it spawns the run's process; a spawn can fail (a missing module, a node that cannot start), or the process can die before it makes a checkout, and then the branch says `running` for a run that never was, capping its command forever.

#### Business logic

Every running card on the branch not seen in the first pass and marked by this host is looked at. When the mark names a pid that is alive on this machine and the run's checkout is not there yet, the run is still booting: left for the next tick. When the checkout is there but carried no live log yet, the run is opening it: left alone. Otherwise the run never got going: when `.agent-scheduler/runs/<id>.stderr` holds anything, the card is written `failed` with the end time and one `ended` line whose detail is `its process died before the run started: ` followed by the last five lines of that stderr; when it holds nothing, the card is written `stopped` with the detail `its process is gone and left no checkout`. The tick's own marker names no pid, so a tick's spawn that failed is caught on the next tick.

### Never another machine's

#### Context

**Problem**: a machine that never comes back leaves its card running and its command capped; nothing here guesses that a run it cannot see is dead.

#### Business logic

A live log or a marker naming another host is skipped in both passes, however old. Only that machine's sweep, or a person editing the branch, changes it.
