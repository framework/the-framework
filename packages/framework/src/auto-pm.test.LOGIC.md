What the tests cover, for the Auto PM sweep's policy and loop:

**Whether a start is allowed**

- **The happy case** - a dry agent queue and a barely touched quota week start an agent in product management mode.
- **The preference** - with Auto PM off nothing starts, from the decision and from the loop alike.
- **The concurrency cap** - a project at its cap is left alone with a reason that says "already going"; below the cap it is topped up rather than refused; at a cap above one the refusal names the cap ("at most 2 at once"); an unset cap means the shipped default of 2, and a cap of zero is floored at one so a hand-edited nought cannot wedge the sweep.
- **Drain before refill** - a queue with open entries starts a drain rather than refusing; a queue that cannot be read refuses with "queue could not be read" instead of counting as empty or as full.
- **The cooldown** - a start one minute ago holds the project off, an hour ago does not; a "Run now" passes through the cooldown but still stops at the cap.

**The quota boundary**

- **Fails closed** - a quota that cannot be read refuses to start ("could not be read"), the opposite of the per-agent guard that never stops the user's own work.
- **Under and at the line** - under the boundary the start is allowed; at the boundary exactly, not only past it, it stands down.
- **Naming where it stands** - the refusal names the window and the line ("99% used, at or past day 3 of the week's 32%"), and with the default half-day spend offset the limit reads to one decimal ("your 39% limit (+7.1 on the week's 32%)"), never fifteen digits.
- **A restarted daemon is not blind** - the reading is the account's absolute week, so a daemon that just started still stands down on a week at 95%.

**The sweep loop**

- **One start per idle project** - an idle project gets an agent; a second sweep inside the cooldown starts nothing more; a refused start gives the cooldown back so the next sweep tries again.
- **"Run now"** - an on-demand sweep runs with the preference off and the report still says the box was off; it skips the cooldown, so a click right after a start starts again; every other stand-down, the cap included, still holds.
- **Unreadable readings** - a queue that cannot be read starts nothing and does not break the sweep; an unreadable switched-off list means no routine is off; an unreadable concurrency falls back to the default of 2, never to one.
- **Stopping** - a daemon stopping while a sweep sits between its readings and the spawn starts nothing, on any project of that sweep; a stopped sweep never runs again.

**The routine rotation**

- **Its order** - update tickets, triage the quick wins, triage the consensual work, then plan; both triage routines are in it; the gated "Suggest tickets to work on" preset is not, and no routine's prompt contains a gate.
- **Walking the cycle** - successive idle sweeps fire the routines in turn and wrap around; a refused start retries the same routine instead of skipping it; a routine the user unticked is filtered out so the remaining ones alternate every turn; with every routine off nothing starts and the reason is "every routine that makes new work is switched off".
- **One agent per turn** - a rotation routine starts one agent however high the concurrency.
- **Nothing left to plan** - a planning turn with no candidate advances the rotation, reports "already has a plan", and the next sweep fires the next routine.

**Drain and refill**

- **The cycle comes back round** - a standing entry is drained, an empty queue is refilled, a new entry is drained again; draining never advances the rotation, so a queue worked off over several sweeps resumes the rotation where it was.
- **Settling finished agents** - an agent whose queue landed ends that sweep so the next one re-reads the queue; a finished agent that wrote nothing is asked about exactly once and then dropped; an agent still going stays tracked.
- **A switched-off drain routine** - the scheduled sweep falls through to the rotation and works nothing off the queue; a drain-only "Run now" stands down instead with "the queue has work waiting and its routine is switched off".

**The maintenance sweep**

- **Its prompt** - the maintenance job fires the "Maintenance" preset over the entire codebase, fully rendered.
- **Its precedence** - a project that is due is swept before the rotation gets a turn; one that is not due, or whose schedule cannot be read, keeps doing the rotation; a queue with work is drained rather than swept, also when the drain routine is off and the turn fell through to the rotation.
- **Its calendar** - a sweep does not cost the rotation its turn; the project is stamped only when the start took; a switched-off maintenance routine leaves its calendar untouched.

**The report**

- **What it says** - after a sweep: whether the preference was on, when it ran, and per project the path, whether an agent started and the sentence ("doing the first thing"); a stand-down carries its reason; a sweep with the preference off reports it off with no per-project line.
- **The next sweep** - before the first sweep the report carries no sweep time and no preference, only the next due time one interval after the loop started; an out-of-band sweep does not shift it.

**The catalog of jobs**

- **What each job declares** - only the drain job says it drains; only the drain job auto-merges its pull request; only "Plan tickets" fans out; the two triage jobs hold a routine lock named after them and their prompts no longer abort on an existing branch.
- **The routines list** - it is the drain, the four rotation routines and maintenance, once each, drain first; every routine carries its preset's label and a fully rendered prompt; only maintenance carries a description line ("sweeping the codebase for maintenance work"), the others are their label.

**Draining fans out**

- **One entry per agent** - a standing queue fans out to the cap in one sweep, each agent pinned to a different entry in queue order, and stops at the cap rather than at the queue's length.
- **Slots are named** - at the cap the reason is exactly "2 runs are already going (run-a (pid 111), run-b (pid 222)), and the routine keeps at most 2 at once", and with nothing to name and a cap of one, "1 run is already going"; a batch that came out short reports "started 2 agents alongside 1 already going (<label>): draining the queue entry "entry a"; draining the queue entry "entry b"".
- **No double hand-out** - an entry pinned to an agent still in flight is not handed out again; a queue whose every entry is being worked stands down with "every open queue entry is already being worked on"; agents already live count against the cap so the sweep tops up rather than doubles; the first refused start ends the batch so the refused work is retried.
- **Drain-only "Run now"** - with entries waiting it fans out like any drain; with an empty queue it says "the queue is empty, so there is nothing to drain" instead of firing a rotation routine.

**Claims on drained tickets**

- **Claimed before the start** - a batch's ticket-linked entries are claimed in one call before any agent starts, each prompt names the ticket "already claimed for you", and the agent ids are minted a millisecond apart from the sweep's clock so a batch stays distinct.
- **Ticketless entries** - an entry with no ticket link is not offered to the claim and drains without one; without the claim seam a ticket-linked entry drains exactly as before, with no claim in its prompt.
- **A lost race** - an entry whose ticket was claimed elsewhere is dropped from the batch, not the batch; a batch that lost every claim stands down with "every entry in this batch links a ticket another agent already claimed".
- **The pinned drain prompt** - with a claim it says the ticket is claimed for the agent, that `tickets show` names it as holder, that it must run `tickets close` once published, and that a ticket claimed by someone else "is not yours"; without a claim the prompt is the plain pin.

**Dead claims**

- **Freed on a commitless ending** - the exact claim minted for an agent that ended with nothing to hand off is released; a sweep that catches the gap between the agent's end and its handoff report holds the claim and releases it once the ending lands; the hold is bounded to two sweeps, after which the agent settles unread.
- **Not drained again** - an entry whose drain ended dry is not offered again for the daemon's lifetime, and the stand-down says "drained once with nothing to hand off".
- **Never-started items** - the claims of a batch's items the start loop never reached are released rather than stranded.
- **Retried releases** - a release that could not land is retried on the next sweep, once more, and then left.
- **Every other ending** - an agent that published, or whose handoff skipped because its pull request already exists, keeps its claim for its own pull request to lift.

**Planning fans out**

- **One claimed ticket per agent** - the planning routine fans out to the cap, one agent per candidate in most-important-first order, the whole batch claimed in one call before any start, each prompt naming the holder; only the tickets actually claimed go out; a claim that took nothing falls back to one unpinned agent with the stock prompt; without the claim seam the routine stays one agent per sweep however high the cap.
- **No double hand-out** - a ticket pinned to a planning agent still in flight is not offered again.
- **The pinned plan prompt** - the pin is appended after the stock prompt, names "exactly one ticket", says `tickets show` names the agent as holder, and tells it to write the plan with `tickets put` and lift the claim with `tickets release`.
- **Plan-only "Run now"** - it spends the whole cap rather than one agent; it plans instead of draining however full the queue is; it stands down with "the planning routine is switched off" when the routine is unticked; it visits only the project the card picked; it costs neither the maintenance sweep nor the rotation its turn.

**Routine locks**

- **Taken and released** - a locked routine takes its lock before the start; while its agent runs the next sweep stands down with the lock's own sentence naming the holder ("triage-quick is already running on laptop (since T0)"); when the agent ends the lock is released, whatever the ending, and the routine may run again in the same sweep.
- **A held lock** - a lock another machine holds stands the routine down naming that holder, with no agent started.
- **Given back and retried** - a refused start gives the lock back at once; a release that could not land keeps the lock standing and is retried on the next sweep.
- **Unlocked routines and unwired loops** - a routine without a lock never asks for one; a loop wired without the locking seam starts a locked routine unguarded; a previous daemon's dead locks are released on a project's first sweep only.

**"Run now" on a locked routine**

- **Lock, then one agent** - the click takes the lock and starts exactly one agent, whatever turn the rotation is on and however much room the cap has.
- **Told apart** - a switched-off locked routine stands the click down with "<label> is switched off"; a lock nothing holds with "no routine holds the <lock> lock"; the cap holds the click as it holds the sweep.
- **Never borrowed** - a full queue does not turn the click into a drain and the rotation's turn does not take it; the scheduled sweep after it still gets the rotation routine it was owed.
