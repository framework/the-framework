The sweep [1]: what a run's [2] own process could not do because it died. Runs on every tick, before anything is decided, and only for this machine: a pid means nothing on another. A checkout [3] whose live card [4] says `running` under a dead pid is a run that died mid-work; a checkout whose card says the run ended is one whose process died between the end and the record, or whose reclaim [5] could not push; a running card on the branch from this machine with no checkout behind it is a run that never started. A running record from another machine is never touched: no age-out, a person's pick.

## Context

**User story**: the user's laptop slept, or a run's process was killed; on the next tick the dashboard shows the run `failed` with what the agent had said until then, its checkout is gone or kept with a reason, and the command's cap is free again; a run on the user's other machine, which this machine cannot see, stays `running` until that machine's sweep or the user says otherwise.

**Business logic story**: the live card is the truth about a run this machine started, so checkouts are read first; the branch's cards are read second, for markers with nothing on disk. Recording and reclaiming are idempotent: a checkout kept once is recorded and reclaimed again on the next tick.

## Glossary

[1] sweep: the pass on every tick that records and reclaims the runs of this machine whose process died, and only this machine's.
[2] run: one agent this tool starts: a detached process of the tool's own, a checkout, one prompt to the coding agent, and a run record when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] live card: the card `<id>.json` under `.the-framework/` in a run's checkout, written by the session as the agent works, beside the diary `<id>.jsonl`; carries the tool's mark with the run's pid and host.
[5] reclaim: removing a finished agent's checkout once its work is on the remote.
[6] marker: a run record written before the agent exists: `status: running`, the tool's mark, an empty diary.

## Business logic — TL;DR

- **Checkouts of this machine** - every checkout under `.branches/` whose live card is this tool's and names this host: `running` under a live pid is left alone; `running` under a dead pid is ended `failed` with `its process died before the run ended`; either way an ended card is recorded with its diary; a `waiting` run is kept, for the answer; any other is reclaimed, kept with the `branches` reason when it cannot go.
- **Markers of this machine with nothing behind them** - a running card marked by this host whose checkout the first pass did not see: left alone while its process is alive and its checkout not there yet (still booting), or while a checkout exists with no live card yet (the run is opening it); otherwise recorded `failed` with the last five lines of the spawn's stderr when there are any, else `stopped` as `its process is gone and left no checkout`.
- **Never another machine's** - a live card or a marker naming another host is that machine's.
- **What the sweep answers** - the runs it recorded with their status, the checkouts it reclaimed, and the ones it kept with why.

## Business logic

### Checkouts of this machine

#### Context

See `## Context`.

#### Business logic

For every checkout under `.branches/`, the live card [4] named for the checkout's id is read; a checkout with no card, a card that does not parse, one without the tool's mark, or one naming another host is skipped. A card saying `running` whose pid is alive is a run at work: left alone. One whose pid is dead is ended from outside: an `ended` line with `its process died before the run ended` appended to the diary, the card set `failed` with the tick's time. Every ended card is then recorded with its diary over the marker [6], idempotent. A `waiting` card keeps its checkout, with the reason `waiting`. Any other is reclaimed [5] under the `branches` rule, pushing allowed, the birth branch named; a checkout that cannot go is kept with the package's reason and its detail.

### Markers of this machine with nothing behind them

#### Context

**Problem**: the tick writes the marker before it spawns; a spawn that never made a checkout, or a process that died before its live card, leaves a running card that no checkout explains.

#### Business logic

Every running card on the branch not seen in the first pass, marked by this host, is looked at. One whose pid is alive and whose checkout does not exist yet is a run still booting: left for the next tick. One whose checkout exists but holds no live card yet is opening it: left alone too. Otherwise the run never started: when the spawn's stderr file under `.agent-scheduler/runs/` has content, the card is recorded `failed` with the detail `its process died before the run started: ` and the last five lines of it; else `stopped` with `its process is gone and left no checkout`.

### Never another machine's

#### Context

**Problem**: a pid is only meaningful on the machine that owns it, and two machines share the branch.

#### Business logic

A live card or a marker whose host is not this machine's is not touched, whatever its pid says.
