Decides, once per sweep [1] and per project, whether the daemon may spend the account's quota [2] on work nobody asked for, and on what. Auto PM [3] either drains [4] the agent queue [5] by starting one agent [6] per open queue entry, or, when the queue is empty, refills it by firing the next routine [7] of a fixed rotation. Every reason not to start is a sentence the daemon logs and the dashboard shows, and every job the sweep fires is built from a preset, so the routines the dashboard lists and the work the daemon actually starts cannot drift apart.

## Context

**User story**: the user switches Auto PM [3] on in the dashboard's Settings and walks away. While the account is under its quota boundary [8] and the project has room for another agent [6], the daemon works the agent queue [5] down, one entry per agent, and once the queue runs dry it brings tickets across from GitHub, triages them onto the queue, and plans the rest, so the leftover quota week is spent on the roadmap instead of expiring. The user clicks "Run now" on a routine's [7] row to fire that routine at once, and reads on the dashboard what the last sweep [1] decided for each project and why.

**Business logic story**: the sweep is pure policy. The daemon supplies the readings (the preferences, the queue, the agents live on a project, the quota [2], the ticket files) and performs the effects (starting agents, writing claims [9] and routine locks [10] on the `agent-data` branch [11], retiring a finished agent's queue entry); the rules about when and what live here, and the wiring in `daemon-services.ts`. The sweep's declared cadence is 10 minutes, taken as turns of the daemon's single clock (`daemon-tick.ts`); the first sweep after start-up is the daemon's to fire. Two sweeps never overlap: a sweep asked for while one is running does nothing, because a sweep reads a picture of the live agents that its own starts change. Nothing of the sweep outlives the daemon: closing the daemon with Ctrl-C ends it, and it cannot be restarted from outside the process.

## Glossary

[1] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[3] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[4] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[7] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[8] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[9] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[10] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[12] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[13] coding agent: the CLI doing the actual work: Claude Code or Codex.
[14] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
[15] backlog loop: after a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[16] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[17] gate: a question with options at which an agent stops and waits for an answer. When nobody can answer, the recommended option is taken.
[18] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[19] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[20] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[21] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **When unattended work may start** - per project, every condition is a reason not to spend, checked cheapest first, and the first one that holds stands the project down with a sentence.
- **The quota boundary fails closed** - an unreadable quota refuses, and a quota window at or past the boundary refuses with the window and the exact line named.
- **The concurrency cap names its slots** - a project keeps at most the configured number of agents going (2 by default, never below 1), and the refusal lists what holds each slot.
- **The cooldown, and the click that bypasses it** - a project is left alone for 30 minutes after the sweep starts something on it, except when a person clicked "Run now".
- **Drain or product management: the queue decides** - a queue with open entries is worked before anything new is made; only an empty queue reaches the rotation.
- **The routine rotation and its order** - update tickets, triage the quick wins, triage the consensual work, plan tickets, in that order, per project, minus what is switched off, advancing only on a start that took.
- **The maintenance sweep is paced by the calendar** - when due it outranks the rotation, but only on a genuinely empty queue, and it stamps its own schedule instead of moving the rotation.
- **Settling what an earlier sweep started** - before judging a queue, finished agents have their entry retired, a claim they abandoned freed, and their routine lock released, each with bounded retries.
- **Draining fans out, one agent per entry** - as many agents as the cap has room for, each pinned to its own open entry, with the entry's ticket claimed first when the entry links one.
- **Planning fans out, one agent per ticket** - the one rotation routine that fans out: each agent is pinned to one claimed ticket, and a batch that could claim nothing falls back to a single unpinned agent.
- **Triage takes a routine lock** - the two triage routines are taken as `routines/<name>.lock.md` before they start, so they run once across machines, and stand down when the lock is alive.
- **Starting the batch, and stopping** - the first refused start ends the batch, claims of agents that never started are released, and a stopped daemon spawns nothing more.
- **"Run now": a sweep a person asked for** - runs with the preference off and without the cooldown, scoped to one project or one routine, and never borrows the click for other work.
- **What the last sweep reports** - the dashboard shows whether the preference was on, when the sweep ran, when the next is due, and one sentence per project, the same sentence the daemon logged.
- **The jobs are built from the presets** - name, prompt, label and tooltip come off the preset; what a job does (drains, fans out, takes a lock, auto-merges) is declared on the job, never matched by name.

## Business logic

### When unattended work may start

#### Context

See `## Context`.

#### Business logic

A sweep [1] first reads the Auto PM [3] preference once, so the toggle takes effect without a restart. Off, or unreadable, ends the sweep before any project is visited, unless the sweep is a "Run now". Then it reads the projects; a list that could not be read is empty and ends the sweep. It re-reads, once per sweep, the routines [7] the user switched off and the concurrency setting, so a change mid-schedule holds for the projects still to come.

For each project, the conditions are checked in this order, cheapest first, and the first that holds stands the project down with its sentence:

- Auto PM is off: "auto PM is off".
- The project already has as many agents [6] live as the concurrency cap allows: the refusal described under "The concurrency cap names its slots".
- The sweep started something on this project less than the cooldown ago: "a run was started for this project a moment ago". A "Run now" skips this condition.
- The agent queue [5] could not be read: "the agent queue could not be read, so there is no way to tell what to do". An unreadable queue is neither empty nor full: both of those answers start something, so only "could not tell" starts nothing.
- The quota [2] could not be read, or a quota window is at or past the boundary: the refusals described under "The quota boundary fails closed".

Otherwise the project may start, in the mode the queue picks (see "Drain or product management: the queue decides"). A stand-down is logged as "auto PM: standing down for <project path> — <reason>" and recorded for the dashboard with the same reason.

### The quota boundary fails closed

#### Context

**Problem**: the quota boundary [8] is the share of the quota week elapsed so far, rising continuously with the clock, moved by the user's spend offset [12]. Work the user asks for may cross it and borrow against the days still to come; work nobody asked for is exactly what the line exists to stop. Quietly burning a subscription on unasked work is a worse failure than skipping a sweep [1], so, unlike the per-agent guard that never stops the user's own work when the quota [2] cannot be read, this check refuses. The reading is the account's own week as the coding agent [13] reports it, absolute and complete, so a daemon that just restarted is not blind to what the account already spent. How a reading is measured against the boundary lives in `quota-boundary.ts`.

#### Business logic

- No reading at all: "the quota could not be read, so there is no way to tell what is spare".
- The reading is asked per project rather than once per sweep: the model a project's work would run on is a project-level setting, and the model's own weekly window binds alongside the account's, so two projects on two models can stand at two different places against the same reading.
- When a window is at or past the limit in force, the refusal names the window and the line it stopped at: "<window label> is <used>% used, at or past day <day> of the week's <boundary>%" when the spend offset is zero, and "<window label> is <used>% used, at or past day <day> of your <limit>% limit (<offset> on the week's <boundary>%)" otherwise. Percentages are whole numbers; the offset carries its sign and one decimal, since a dragged slider stores whole numbers but the default half-day cushion is 100/14. Naming the line is what keeps a user whose slider is moved from hunting for a bug that is a setting.
- Otherwise there is headroom and the sweep goes on.

### The concurrency cap names its slots

#### Context

**Problem**: the point of the cap is that Auto PM [3] may overlap work; a cap of one would leave the fan-out [14] invisible until someone finds the control. A cap reached by a process the dashboard's Agents panel no longer shows looks exactly like one reached by real work, so a bare number cannot be questioned; a named slot can be looked up.

#### Business logic

- The cap is the concurrency setting, re-read every sweep [1]. Unset or unreadable means 2, never 1: the absence of the setting has never meant "less". Fractions are rounded down, and the result is never below 1, since zero agents is what switching Auto PM [3] off is for.
- Every agent [6] live on the project counts against it, whoever started it.
- At the cap, the refusal is "<n> run is already going" or "<n> runs are already going", followed by the labels of the live agents in parentheses, each label being the agent's id and process id as the daemon holds them; when the cap is above 1 the sentence continues ", and the routine keeps at most <cap> at once". At a cap of 1 the wording stops after the names.
- The cap holds for a "Run now" too: it is what keeps a second click from doubling up, since a start registers before the sweep moves on.
- A batch is sized to the room left: the cap minus the agents live on the project.

### The cooldown, and the click that bypasses it

#### Context

**Problem**: a spawned agent [6] takes a moment to appear among the daemon's live agents; without a pause, the next sweep [1] would see "nothing running, queue still empty" and start a second one.

#### Business logic

- A project is left alone for 30 minutes after this sweep started something on it: "a run was started for this project a moment ago". Only the sweep's own starts arm it; an agent the user started counts toward the cap instead.
- The cooldown is armed before the first spawn of a batch and once for the whole batch: starting is slow, and a sweep overlapping the spawns would otherwise see too few live agents and top up past the cap. When the batch started nothing, the cooldown is given back, so a project is not stranded for half an hour by a start that spent nothing.
- A "Run now" ignores the cooldown: the cooldown paces work nobody asked for, and a click is asking. Every other reason to stand down still holds.

### Drain or product management: the queue decides

#### Context

**Problem**: the backlog loop [15] that works the agent queue [5] exists only inside an agent [6] a human started. Unattended [16], a queue that only ever got filled would never empty, so a non-empty queue is not a reason to stand down: it is the thing to do, and standing work is spent before more is made.

#### Business logic

- A queue with open entries puts the sweep [1] in drain [4] mode: agents are started on its entries, through the drain job.
- An empty queue puts it in product management mode: the routine [7] whose turn it is fires, or the maintenance sweep when due.
- When the drain routine is switched off while the queue has work, the sweep does not stand down: the rotation gets the turn instead. Switching the drain off means "do not work the queue", and the rotation does not work it; triage and planning put entries on it. Standing down here would make every routine that invents work unreachable for as long as the queue had anything on it, which, with a queue that fills itself, is most of the time. A drain-only "Run now" is the exception: it has already stood down by then, because the click asked for the queue specifically.
- The maintenance sweep never fires while the queue has entries, including when the turn fell through to the rotation because the drain routine is off.

### The routine rotation and its order

#### Context

**Problem**: the rotation is a cycle whose order matters. Importing leads because it is the only routine [7] that can add a ticket none of the others has seen; without it a rotation that triages and plans a set nothing refills eventually has nothing to do, and a new GitHub issue would wait for a human to press a button. Triage turns tickets into queued work. Planning is the most expensive turn and the one whose output the earlier routines consume, so it runs last. No separate scheduler exists or is needed: the rotation fires on every sweep [1] where the queue is dry, which is exactly when the queue wants refilling.

#### Business logic

- The order: "Update from GitHub" (`update-tickets`), "Add quick-win work to AI Queue" (`triage-quick`), "Add consensual work to AI Queue" (`triage-consensual`), "Plan tickets (aka spike)" (`plan-tickets`). Importing is safe to repeat: the preset resumes from where the last import stopped and reconciles, so a firing with nothing changed is a no-op rather than a re-import.
- The position in the cycle is kept per project, so two projects idle at once each work through the whole rotation rather than taking alternate halves of it. Nothing of it survives the daemon.
- The routines the user switched off are removed from the cycle before the position is applied, so with two of four off the remaining two alternate instead of every other turn landing on a routine that cannot run. The switched-off list is re-read every sweep, and a list that cannot be read means none is off: a preference that cannot be read must not silently switch the whole rotation off.
- The position advances only when a start took, so a refused start is retried rather than skipped, and only for a rotation routine fired by the rotation itself: a drain, the maintenance sweep and a routine a click named all leave it where it is. A planning turn that finds nothing left to plan also advances it, because that is the routine's work being done rather than refused, unless a click named the routine.
- When every routine that makes new work is switched off, the project stands down with "every routine that makes new work is switched off"; a daemon wired with no routines at all says "there is no job to run". The two are told apart on purpose: the first is a setting the user can see and undo.
- No routine may end at a gate [17]: the "Suggest tickets to work on" preset, which stops to ask, is deliberately not a routine, since firing it unattended [16] would park an agent [6] against a human who will never answer, and no routine's prompt may contain a gate.

### The maintenance sweep is paced by the calendar

#### Context

**Problem**: the "Maintenance" preset looks at the codebase's standing history rather than at new tickets, so a rotation that cycles every idle sweep [1] is the wrong pacing for it. It is paced by a calendar kept in the project's checkout (the schedule lives in `maintenance.ts`), so a project that adopted The Framework late gets its pre-existing history looked at, an interval at a time.

#### Business logic

- When due, the maintenance sweep outranks the rotation: the entries it queues are what the rotation would otherwise be inventing work instead of. It fires only while the agent queue [5] is genuinely empty, never on a "Run now" that named a routine [7], and never while the maintenance routine is switched off.
- The switch is checked before the schedule is read, so a switched-off maintenance sweep costs no disk read and leaves its calendar untouched: it comes due normally once switched back on, rather than having been silently ticked past while off. A schedule that cannot be read means "not due", so the rotation keeps running rather than sweeping on every turn.
- Its firing does not advance the rotation. Instead the project is stamped as swept once the start took, so the next maintenance sweep is an interval away; a start the daemon refused is retried on the next sweep rather than postponed a whole interval.
- Its prompt covers the entire codebase, and its start is reported as "sweeping the codebase for maintenance work".

### Settling what an earlier sweep started

#### Context

**Problem**: a drained queue entry stays on the agent queue [5] until the daemon retires it, and a claim [9] minted for an agent [6] is normally lifted by that agent's own pull request. An agent that ended with no commits never opens one, so its claim would stand until a human clicks "Release", and the queue would livelock on the dead claim, respawning the same work every cooldown. The sweep [1] is the one place that knows both which agents it started and how they ended, so it frees exactly the claims it minted, keyed off the recorded ending and never off a timer.

#### Business logic

Before judging a project's queue, every agent this sweep started on it and has not yet finished settling is looked at. The daemon reads the agent's status and recorded ending and retires the entry the agent was pinned to once the ending says the work was published (`daemon-services.ts`); the sweep decides what to do with the answer:

- Still running: kept for the next sweep.
- Ended cleanly, but its handoff [18] has not reported yet: an agent carrying a claim or pinned to an entry is held for at most two more sweeps rather than settled blind, since the ending is the one fact the release and the entry's retirement key off. Past that bound it settles unread, so a process that died mid-handoff cannot pin its entry forever.
- Ended with nothing to hand off, carrying a claim minted here: the claim is freed by the sweep itself, and only the exact minted claim; a lock naming anyone else is left alone. The entry, or the planned ticket, is remembered as having ended dry before the release is attempted, and is not offered again for the rest of the daemon's life: a task that deterministically ends without commits would otherwise burn a quota [2] run every cooldown, forever. A daemon restart forgets the set and allows one more try, on the assumption that a human retired or reshaped the entry in between. A release that could not land, a transient git lock for instance, is retried on the next sweep, at most twice.
- Held a routine lock [10]: the lock is released whatever the ending, since no pull request of the agent's ever will; a release that could not land is retried, at most twice.
- When settling retired one or more entries, the queue this sweep would read is stale, so the project is left to the next sweep with "landed the queue from <n> finished run(s)", logged as "auto PM: landed the queue from <n> run(s) in <project path>".
- On a project's first sweep after the daemon started, the routine locks a previous daemon on this machine left behind whose agents are gone are released once, since nothing else would ever release them.

### Draining fans out, one agent per entry

#### Context

**Problem**: with a single agent [6], "work the first open entry" is exact. With several going at once it is a collision: every agent forks the same checkout [19], reads the same first entry, and implements it as many times over. Naming the entry per agent is what makes a batch work on disjoint things, and a claim [9] on the entry's ticket, pushed to the `agent-data` branch [11], is what keeps another machine's sweep [1] from implementing the same ticket; without it the booking lived only in this daemon's memory.

#### Business logic

- The entries on offer are the open entries, in queue order, minus those pinned to agents still in flight and minus those that already ended dry. None left stands the project down with "every open queue entry is already being worked on", or, when at least one open entry ended dry, "every open queue entry is being worked on, or already drained once with nothing to hand off". An entry someone else already worked is not on the queue to begin with: its check-off travels in that agent's own pull request and the merge takes it off.
- The batch is the first entries on offer, as many as the cap has room for.
- Each agent's agent id [20] is minted by the sweep before any claim, from the sweep's clock and a millisecond apart, so the claim names the agent that is about to start and the agent starts with that same id: the claim and the agent are one.
- An entry that links back to a ticket, as a markdown link into `tickets/`, has its ticket claimed before its agent starts, the same pushed `.lock.md` planning makes, but skipping only on an existing claim: a plan is the drain's input, not a competing claim. The claims are matched back by agent id, since two entries linking the same ticket race for one claim and only the one whose id the claim names may carry it. An entry whose ticket was claimed elsewhere is dropped from this batch and reconsidered next sweep; a batch that lost every entry this way stands down with "every entry in this batch links a ticket another agent already claimed". An entry that links no ticket has nothing on disk to claim and proceeds with the queue document as its only coordination point.
- The agent's prompt names its one entry: "Work on this one open entry of the agent queue only (use the `tickets` skill):", the entry, then "Do not start any other entry, and do not take the entry off the queue — the framework does once your work lands. If the entry is no longer on the queue, stop and do nothing." With a claim, it adds that the ticket "is already claimed for you", that `tickets show <ticket>` names the agent as its holder [21], that once the work is published the agent runs `tickets close <ticket>` (closed tickets leave the branch and the claim goes with the ticket), and that a ticket not claimed or claimed by someone else "is not yours — stop and do nothing". The assignment is a snapshot: a human may retire the entry between the sweep's read and the agent's own.
- The queue entry is never the agent's to check off: the daemon retires it once the agent's ending reports the work landed.
- A drain agent's pull request is merged once the agent opens it: what it implements was triaged as consensual, quick-win work a human could have vetoed on the queue, so its review happened before the agent.
- The start is reported as 'draining the queue entry "<entry>"', the entry flattened to one line and cut at 80 characters with an ellipsis.

### Planning fans out, one agent per ticket

#### Context

**Problem**: the stock planning prompt covers every ticket that has no plan or claim [9] yet, and with a batch going out that instruction is the same collision draining has: every agent [6] forks the same checkout [19] and picks the same most-important ticket. Planning is the one rotation routine [7] that may fan out [14], because it writes each ticket's own sibling files rather than rewriting the shared queue document, so concurrent copies do disjoint work and land disjoint edits. Every other rotation routine rewrites the whole queue from the same fork point, and two at once would revert each other's edits, so those stay one agent per sweep [1].

#### Business logic

- The candidates are the tickets with neither a plan nor a claim, most important first (the daemon reads them off the `agent-data` branch [11]), minus the tickets pinned to planning agents still in flight and minus those whose planning agent already ended dry. A list that cannot be read means no candidates.
- No candidates stands the project down with "every open ticket already has a plan, or an agent on the way to one", and the rotation advances: nothing left to plan is the routine's work being done, not a refusal, so the next sweep tries the next routine instead of re-asking forever. A "Run now" that named the routine advances nothing.
- The batch is the first candidates, as many as the cap has room for. Agent ids [20] are minted first, from the clock; then the claims are written as one batch and pushed, one `.lock.md` per ticket reading `CLAIMED: <agent id>`, so agents forked from any checkout, and cloud sessions in particular, find the file and skip the ticket. Only the tickets actually claimed get an agent: a ticket lost to a race costs one agent of the batch, not the batch. When nothing could be claimed, or the daemon has no way to claim, one unpinned stock agent runs, which is safe without a claim.
- The pin is appended to the stock prompt rather than spliced into it, so the verdict rules the preset carries ride along verbatim and a rewritten preset cannot silently lose the pin: "You are one agent of a concurrent batch, so the scope above narrows: plan exactly one ticket, `tickets/<file>`, and no other." Then the claim contract: the ticket "is already claimed for you", `tickets show <file>` names the agent as its holder [21], the agent writes the plan with `tickets put <stem>.plan.md` and lifts its claim with `tickets release <file>`, because the plan is a write to the `agent-data` branch and not a pull request; a ticket not claimed, claimed by someone else, or already planned "is not yours — stop and do nothing". Nothing else releases the claim: a forgotten one stands until a human clicks it away.
- The start is reported as 'planning "<ticket file>"'.

### Triage takes a routine lock

#### Context

**Problem**: the two triage routines [7] rewrite the shared agent queue [5] and may take hours; two at once, on any machine sharing the `agent-data` branch [11], would revert each other's edits. Which routine holds a lock is declared on the routine, never matched by its name, so a rename cannot quietly unhook it.

#### Business logic

- "Add quick-win work to AI Queue" holds `routines/triage-quick.lock.md` and "Add consensual work to AI Queue" holds `routines/triage-consensual.lock.md`, each a routine lock [10] on the `agent-data` branch, written and pushed before the agent [6] starts so every machine sharing the branch sees the routine as taken.
- A lock that is alive, held by another machine's triage or by this one's still going, or that could not be written, stands the routine down with the lock's own reason and no agent started; when the taking itself fails, the reason is "the routine lock could not be taken". The rotation stays on that routine, so the next sweep [1] tries it again.
- The lock is released when the agent ends, whatever the ending, with the bounded retries described under "Settling what an earlier sweep started", and released at once when the daemon refused the start, since no agent will ever release it.
- Locks a previous daemon on this machine left behind are released on a project's first sweep.
- A daemon wired without the locking seam starts the routine unguarded.

### Starting the batch, and stopping

#### Context

**Problem**: an agent [6] spawned after the daemon has begun closing is missing from the live-agent map the daemon has by then cleared, so nothing would ever stop it. Claims [9] are pushed before the first spawn, so an agent that never starts would strand a claim no agent could ever settle free.

#### Business logic

- Stopping the sweep [1] is a verdict on the whole sweep: it is re-checked after every wait and before every spawn, and a stop mid-batch spawns none of the rest.
- Each start is logged as "auto PM: <what it does> in <project path>", where "what it does" is the routine's description line when it has one, else its label, else its name.
- The first start the daemon refuses ends the batch: whatever refused it is not going to take the next one a moment later, and a refused routine must be retried rather than skipped. It is logged as "auto PM: could not start a run in <project path>", and a routine lock [10] taken for it goes back at once.
- After the batch, the claim of every item that never started is released: those never enter the settling loop, so nothing else would free them.
- When nothing started, the cooldown is given back and the project is recorded as "the daemon could not start a run", or as the lock's reason when a lock stood the routine down.
- When something started, the project is recorded with what: a single start keeps its own sentence; several read "started <n> agents: <sentence>; <sentence>; …". Either is followed by " alongside <m> already going (<labels>)" when agents were already live, so a batch that came out short of the cap says what it was short by.

### "Run now": a sweep a person asked for

#### Context

**User story**: the user clicks "Run now" on a routine's [7] row, or on the drain [4] row, in the dashboard, with or without a project picked, and the sweep [1] runs for that at once. The same wake happens when the user switches Auto PM [3] on, so the box just ticked does not wait a whole interval to do anything.

#### Business logic

- The Auto PM preference is consent to spend quota [2] unasked, and a click is asking: a "Run now" runs with the preference off. The preference is still read, so the report says where the box stood.
- It skips the cooldown. The concurrency cap, the quota boundary [8] and the switched-off routines all still hold.
- With a project picked, only that project is visited; a project id that matches nothing stands the sweep down rather than silently widening it to every project. Without one, every project the daemon watches is visited, which is what the drain row's button says it does.
- A drain-only "Run now" works the queue or says why not: "the queue is empty, so there is nothing to drain", or "the queue has work waiting and its routine is switched off". It never borrows the click for a rotation routine the user did not ask for.
- A planning "Run now" fires the fan-out [14] routine of the enabled rotation, through the same claim-then-start path the rotation takes, cap included; with it switched off the sweep stands down with "the planning routine is switched off".
- A triage "Run now" names the routine by the lock it holds, so the lock is taken before the start; a plain start outside the sweep would run unguarded. A lock no enabled routine holds is told apart: "<label> is switched off" when the routine exists but is unticked, and "no routine holds the <lock> lock" when nothing holds it, which is a dashboard older than its daemon.
- A click that named a routine takes the turn outright: it is never a drain however full the queue is, never the maintenance sweep, and it moves neither the rotation's position nor the maintenance calendar, since it did not come from the cycle.

### What the last sweep reports

#### Context

**Problem**: every decision is logged, but the log is the daemon's terminal and the toggle lives in a browser; from the dashboard a wedged sweep [1] and a healthy idle one would look identical.

#### Business logic

- The dashboard is told whether the preference was on at the last sweep, when that sweep finished, when the next is due, and one line per project visited, in sweep order: the project's path, whether an agent [6] was started, and the sentence, which is exactly the sentence the daemon logged.
- The next sweep's time is counted from the moment the sweep loop started, in whole intervals, so a "Run now" does not shift the schedule.
- The last sweep is recorded even when it ended early, so "switched off" and "on, and standing down for a reason" are distinguishable. Before the first sweep, the report carries only the next due time and no outcomes.

### The jobs are built from the presets

#### Context

**Problem**: the dashboard lists the routines [7] and the daemon fires them; written out twice, the two would drift. What a job does is declared as data on the job, so a renamed preset cannot quietly unhook the behavior tied to it.

#### Business logic

- Each job carries the preset's stable name, which is what the rotation's position and the switched-off list key on; the prompt rendered from the preset; and the preset's label and one-line tooltip, read off the preset so a relabeled preset relabels its routine and the sentence the launcher shows for a preset is the sentence the routines list shows for its routine.
- Only the maintenance job carries a separate description line, "sweeping the codebase for maintenance work", because "Maintenance" names its preset rather than the work; the other routines' labels read as what they do, so their rows stay one line and their log lines say the label itself.
- The drain [4] job is the "Spin up agents working on the AI queue" preset (`drain-queue`), declared as draining and as auto-merging its pull request. The planning job is declared as fanning out [14]; the triage jobs each declare their routine lock [10].
- The routines list, in the order a surface shows them, is derived from the same jobs the daemon runs: the drain first, because it is what happens whenever there is queued work; the four rotation routines next, because they are what happens when there is not; the maintenance sweep last, as the calendar-paced exception outside both.
