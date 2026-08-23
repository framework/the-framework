The usage panel's surface: where the account's quota week stands against the quota boundary, what Auto PM last decided, and the "Run now" that fires a sweep immediately.

## Business logic — TL;DR

- **An unreadable quota shows as unavailable, never as unused** - when the quota cannot be read, the panel is told so explicitly instead of being handed zeroes.
- **Auto PM's last decision is reported, or nothing** - a loop that has nothing to say yet is reported as having nothing to say, not as an idle sweep.
- **"Run now" sweeps even with unattended work switched off** - the Auto PM preference is consent to spend quota unasked; pressing the button is asking.
- **"Run now" waits for the sweep and reports what it decided** - one outcome line per project, taken from the sweep that click fired.

## Business logic

### An unreadable quota shows as unavailable, never as unused

#### User story

The user looks at the usage panel to decide whether there is room to start more work.

#### Business logic

The panel is served the account's quota week and where it stands against the quota boundary. When the reading cannot be obtained, the answer carries no windows and an explicit "could not be fetched" — not zeroes.

#### Rationale

An empty bar reads as "nothing used", which is the one thing this panel must never imply.

### Auto PM's last decision is reported, or nothing

#### User story

Under the panel's toggle, the user wants to know what Auto PM did last and why — whether it worked, or stood down, and on what grounds.

#### Business logic

Auto PM's own report is served alongside the quota, because it is the same panel and the same limit: Auto PM spends against exactly the boundary drawn above it. A loop that has not reported anything yet answers with nothing, which the panel renders as "nothing to say" rather than as a sweep that found nothing to do.

### "Run now" sweeps even with unattended work switched off

#### User story

The user wants the framework to do its scheduled work now rather than at the next interval.

#### Business logic

The sweep is fired on demand. The Auto PM preference does not gate it — that preference is consent to spend quota unasked, and this call is the user asking — so the daemon sweeps once even with unattended work switched off, while every other stand-down reason still applies and the schedule stays exactly as configured.

The sweep can be narrowed to one routine's work, which is what a "Run now" that fans out means: draining starts agents on the agent queue's entries, planning on the open tickets. The fan-out is the sweep's own, because a plain start could only ever be one agent; and having nothing to work is reported as such rather than quietly turned into some other job. A routine pinned to one branch still starts a single agent, but the sweep releases a stale copy of that branch first, which a plain start never did. The sweep can also be scoped to the one project the card has picked.

### "Run now" waits for the sweep and reports what it decided

#### User story

The user presses "Run now" and expects to see what happened.

#### Business logic

The call waits for the sweep to finish and answers with the sweep's outcomes, one line per project, read from Auto PM's own report once the sweep has resolved — so the card can state them without a poll racing the sweep. A sweep that itself failed is reported as a failure.

#### Rationale

The press used to be fire-and-forget, so two presses could show literally nothing: no loading state, no outcome, and the stand-down reason recoverable only from the daemon's own logs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
