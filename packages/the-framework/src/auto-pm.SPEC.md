Auto PM spends leftover subscription quota on the product's own roadmap: while the account is under its weekly boundary and nobody is at the keyboard, the daemon works the agent queue down and, once it is empty, refills it — importing, triaging, then planning tickets.

## User Stories

- The user leaves the keyboard and comes back to a worked-down queue and freshly imported, triaged, and planned tickets.
- The user caps how many unattended agents a project runs at once and switches individual routines off.
- The user clicks "Run now" on a routine and it runs, even while the master switch is off.
- The user reads the reason for every sweep pass that started nothing, so a setting never looks like a bug.

## Flows

- Whether a pass starts anything is one pure policy question per project — enabled, under the concurrency cap, past the cooldown unless a person asked, queue readable, quota under the boundary; the sweep loop only supplies the readings.
- A standing queue is drained before new work is invented; a calendar-paced codebase maintenance sweep outranks the rotation when due, and only ever while the queue is genuinely empty.
- Draining and planning fan out, one pinned queue entry or locked ticket per agent, so concurrent agents do disjoint work; every other routine stays one per pass since concurrent copies would undo each other.
- Both phases claim their ticket with a pushed lock file before the agent starts, so agents on other machines cannot double-book it: planning locks the ticket it will plan, and draining locks the ticket its queue entry links back to. An entry claimed elsewhere is dropped from the batch, and an entry with no ticket behind it keeps the queue itself as the coordination point.
- A claim whose agent settled with nothing to hand off is released by the sweep: the pull request that normally lifts the lock is never coming, and without the release the queue would jam forever on a dead claim. The freed work is not respawned by this daemon — one commitless run is evidence for a human, not an invitation to repeat it every cooldown. A claim whose agent never even started (a refused spawn, a stop mid-batch) is freed the same way.
- The queue coordinates a ticketless entry only once its check-off is on the data branch, and that leaves a window: an agent handed off to a cloud session settles locally before its published work is adopted, so until the check-off lands the entry still reads open, and past the cooldown it can be fanned out to a second agent. The same window opens when the daemon restarts, since only its in-memory pin covered the wait.
- The two triage routines each work on one fixed branch, and their agent refuses to start when that branch already exists, so two triages never run at once. Before firing either — from the schedule or from its "Run now" — the daemon deletes a leftover copy of that branch whose pull request is closed or merged; a branch with an open pull request, or with no pull request history at all, is kept, since that may be a triage still under way.
- Each routine can be switched off individually, and every stand-down is reported with its reason: a wedged sweep must not look like a healthy idle one.
- Switching the draining routine off means "do not *work* the queue", not "do nothing": the pass falls through to the rotation, which puts entries *on* the queue rather than taking them off. The one exception is a click that asked for the queue by name: a drain-only sweep says why it cannot, rather than borrowing the click.

## Rationales

- An unreadable quota fails closed — the opposite of the per-agent guard: quietly burning quota on work nobody asked for is worse than skipping a pass.
- Where the account stands is asked per project rather than once per pass, because the model a project's work would run on is a project setting and each model's own weekly allowance binds alongside the account's. Two projects on two models can therefore stand at two different places against the same reading.
- "Run now" skips the master switch and the cooldown: the click is the consent the preference exists to record, and the cooldown paces work nobody asked for — without skipping it, the button could start nothing for half an hour after any run. Every other stand-down holds: a click cannot exceed the concurrency cap, and that cap is what keeps a second click from doubling up.
- A "Run now" can ask for one routine's work in one project, rather than a whole pass: it never falls through to work the click did not name, a switched-off routine stands it down instead of being overridden, and it leaves the rotation on whichever turn it was on.
- A triage's "Run now" goes through the pass rather than starting its agent directly, so it gets the same branch release the schedule gets: started directly, the click died on the branch the previous triage left behind, and kept dying on every click until someone deleted it by hand.
- A switched-off draining routine falls through to the rotation rather than standing the pass down, because a stand-down would make every inventing routine unreachable whenever the queue holds anything — and the queue is auto-populated, so it usually does.
- The ticketless hand-off window is accepted rather than closed: closing it would take a durable per-entry claim — a second claim shape beside the pushed ticket lock that already covers the queue's normal case — for a race whose cost is a duplicated attempt, never lost work.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
