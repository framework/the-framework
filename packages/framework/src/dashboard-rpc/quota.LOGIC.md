The three things the dashboard's usage panel asks the daemon: where the account's quota [1] stands against its quota boundary [2], what Auto PM [3] decided the last time it swept, and a request to sweep [4] now instead of at the next tick [5]. The first is a reading that may not exist, and the panel must never mistake "we could not read it" for "nothing used", so a failed reading is answered as an explicit absence.

## Context

**User story**: the user watches the usage panel to see how much of the week's allowance is gone, whether unattended [6] work is standing down against the quota boundary [2], and what Auto PM [3] is doing about the roadmap — with a "Run now" that makes it act immediately rather than at its next tick [5].

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[4] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[6] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[8] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[9] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[10] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[11] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
[12] ticket: a markdown file under `tickets/` on the `agent-data` branch, with an optional plan and claim.
[13] routine lock: a file on the `agent-data` branch a daemon takes before running a routine so the routine runs once across machines.
[14] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[15] project: a repository the user registered in the dashboard, identified by an id derived from its path.

## Business logic — TL;DR

- **Where the quota stands** - the account's windows, when they were read, why they could not be read, and where the account stands against its quota boundary [2].
- **No reading is said, never implied** - a reading that fails answers with no windows and no boundary at all, because an empty bar would read as "nothing used".
- **What Auto PM last decided** - whether it was switched on at the last sweep [4], when that was, when the next is due, and one line per project [15] it considered.
- **Sweep now** - a sweep the user asked for runs even with Auto PM [3] switched off, changes no schedule, and answers with what it decided.

## Business logic

### Where the quota stands

#### Context

**User story**: the usage panel shows how much of the session window and of the quota week [1] is spent, and where that sits against the quota boundary [2] that holds unattended [6] work back.

#### Business logic

The daemon answers with the account's quota [1] windows as the coding agent reported them — the session window, the quota week, and the week for each model — together with when that reading was taken and where the account stands against its quota boundary [2] (the measuring itself is in `../dashboard/quota.ts`). The dashboard's panel asks for this repeatedly for as long as it is open, so the picture follows the clock.

The boundary is absent when there is no reading, and also when the week's reset moment could not be placed. That absence means "not known", not "nothing may be spent".

### No reading is said, never implied

#### Context

**Problem**: the panel draws a bar. A reading that failed, reported as zeroes, would draw an empty bar — which says "nothing used", the one thing this panel must never say when it does not know.

#### Business logic

When the reading cannot be taken at all, the answer holds no windows and no boundary [2], and states that it is unavailable. Nothing is filled in with zeroes.

A reason for unavailability also travels alongside a reading that is still present but old: the last good reading is kept through a failed attempt, and the reason says the newest attempt failed, so the panel can mark the figures as stale instead of blanking them.

### What Auto PM last decided

#### Context

**Problem**: every decision Auto PM [3] takes is written to the daemon's own output, but the switch that controls it lives in a browser. Without this read, a wedged sweep [4] and a healthy one that simply had nothing to do look identical from the dashboard.

#### Business logic

The daemon answers with what Auto PM [3] decided at its last sweep [4]: whether the switch was on at that moment, when the sweep finished, when the next one is due, and one line per project [15] it considered, in the order it considered them. Each line names the project, its path, whether an agent [7] was started for it, and the sentence saying what was started or why it stood down.

When there is nothing to report — a daemon that has not finished starting, or a host that runs no Auto PM at all, such as the dashboard of a machine another user connected to — the answer is an explicit "nothing to say", which the panel shows as such rather than as an idle sweep. That distinction is the whole reason this read exists.

### Sweep now

#### Context

**User story**: the user presses "Run now" and expects the daemon to act at once and to say what it did, instead of waiting for the next tick [5] and leaving the user to guess.

**Problem**: the Auto PM [3] switch is consent to spend quota [1] unasked. A click is asking, so a sweep [4] the user requested must not be gated on that switch — and must not quietly turn it on either.

#### Business logic

The daemon runs one sweep [4] immediately. It runs whether or not Auto PM [3] is switched on, and it changes no preference [14] and no schedule: the switch stays exactly where the user left it, and the regular sweeps go on as before. Every other reason to stand down still holds — agents [7] already running, the quota boundary [2], routines [10] the user switched off.

The answer waits for the sweep to finish and carries what it decided, one line per project [15], so the panel can state the outcome without a poll having to race the sweep. A sweep that failed outright answers that it did not succeed. A sweep that ran but whose decisions could not be read back answers as a success with no lines.

The request can narrow what the sweep does, which is what a "Run now" that fans out [11] means:

- draining [9]: agents [7] are started on the agent queue's [8] entries. When the queue is empty this is reported as having nothing to work, rather than the click being borrowed for some other routine's [10] work nobody asked for.
- planning: agents are started on the open tickets [12] to plan, through the same claim-then-start path the scheduled routine takes, so the fan-out [11] respects the same limits and claims.
- one named routine [10], identified by the routine lock [13] it takes: a single agent, started by the sweep so the lock that guards it is taken the same way the scheduled run takes it, and started from a fresh copy of its branch.

The request can also be scoped to a single project [15], which is what the panel's own project selection means.
