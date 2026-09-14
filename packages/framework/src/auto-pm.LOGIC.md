Decides, once per look [1] and per project, whether the daemon may spend the account's quota [2] on work nobody asked for, and on what. Auto PM [3] either starts an agent [6] on the queued work [4] because the `agent-data` branch [11] moved, or, once a run found nothing queued, refills the agent queue [5] by firing the next routine [7] of a fixed rotation. The daemon reads no queue and names no skill: it reads the head of the branch, and it starts the queued work with one slash command, `/work-queue`, the command skill [22] shipped with The Framework. Every reason not to start is a sentence the daemon logs and the dashboard shows.

## Context

**User story**: the user switches Auto PM [3] on in the dashboard's Settings and walks away. Someone queues three tasks, on this machine or another. Within a minute the daemon starts an agent [6] on the queue; the agent takes one task, commits, closes its ticket and marks the entry done; those commits move the branch, so as the run ends the daemon starts the next; the fourth run finds nothing queued, says so, and the chain stops. Then the daemon brings tickets across from GitHub, triages them onto the queue, and plans the rest, so the leftover quota week is spent on the roadmap instead of expiring. The user clicks "Run now" on a routine's [7] row to fire that routine at once, and reads on the dashboard what the last look [1] decided for each project and why.

**Business logic story**: the sweep is pure policy. The daemon supplies the readings (the preferences, the head of the branch and how many commits since the last look nobody's daemon wrote, the agents live on a project, the quota [2], the ticket files a plan fan-out may claim) and performs the effects (starting agents, writing claims [9] and routine locks [10] on the `agent-data` branch [11]); the rules about when and what live here, and the wiring in `daemon-services.ts`. The look runs once a minute, right behind the daemon's pull of the branch, as turns of the daemon's single clock (`daemon-tick.ts`); the first look after start-up is the daemon's to fire. Two looks never overlap: a look asked for while one is running does nothing, because a look reads a picture of the live agents that its own starts change. Nothing of the sweep outlives the daemon: closing the daemon with Ctrl-C ends it, and it cannot be restarted from outside the process.

## Glossary

[1] look: one turn of Auto PM on the daemon's clock: read the branch, close out finished runs, decide, start or stand down. The dashboard and the log call it a sweep.
[2] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[3] Auto PM: the daemon's unattended product management: work the agent queue when the `agent-data` branch moves, and refill it by running the routines.
[4] the queued work: the routine that spends existing work: one agent started with `/work-queue`, which takes one task off the agent queue by composing the skills in its checkout.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry. The daemon never reads it.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[7] routine: a job the daemon fires on its own — the queued work, update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand. The queued work is a skill file; the rest are presets.
[8] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[9] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[10] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[12] spend offset: the user's adjustment of the quota boundary, in percentage points of the week.
[13] coding agent: the CLI doing the actual work: Claude Code or Codex.
[14] fan-out: starting several agents at once, one per ticket to plan.
[15] a move: a commit on the `agent-data` branch that no daemon wrote — a person queuing an entry, an agent claiming, closing or marking done. A daemon's own commits carry a trailer (`daemon-writes.ts`) and are not moves.
[16] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[17] gate: a question with options at which an agent stops and waits for an answer. When nobody can answer, the recommended option is taken.
[18] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[19] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[20] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[21] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[22] command skill: a skill file (`SKILL.md`) marked so that only a person or the daemon invokes it, whose body is the job's prompt, shipped as its own package; the daemon starts the agent with the skill's slash command and the coding agent's harness expands it.
[23] the heartbeat: one run on the queued work a day when nothing moved, the belt for a move the daemon missed.
[24] the chain: the queued work firing again as its run ends, because the run's own commits moved the branch; it ends with a run that moves nothing.

## Business logic — TL;DR

- **What the daemon reads** - the head of each project's `agent-data` branch [11], once a minute, and how many commits since the last look were written by something other than a daemon; nothing else about the branch, and no queue.
- **A move starts the queued work** - a commit no daemon wrote [15] starts one agent with `/work-queue`; a daemon's own commits — run records, routine locks, claims — never do, so a run's record cannot start the next run, and two daemons sharing a branch never fire at each other.
- **The chain** - the agent's claim, close and done are commits, so the branch has moved again by the time the run ends, and the daemon fires again; a run that found nothing queued writes nothing, and the chain stops.
- **After an empty run, the rotation** - every run this loop started has ended and none moved the branch: the queue wants refilling, so the next routine [7] of the rotation gets the turn; a rotation run that moved nothing hands the turn on, at the cooldown's pace.
- **The first look remembers, and owes the rotation its start-up turn** - a daemon that just started knows nothing about what moved while it was down; it remembers the head, starts nothing on the queued work, and takes the rotation's turn as a daemon always has.
- **The heartbeat** - once a day with nothing moved, the queued work runs anyway [23].
- **When unattended work may start** - per project, every condition is a reason not to spend, checked cheapest first, and the first one that holds stands the project down with a sentence.
- **The quota boundary fails closed** - an unreadable quota refuses, and a quota window at or past the boundary refuses with the window and the exact line named.
- **The concurrency cap names its slots** - a project keeps at most the configured number of agents going (2 by default, never below 1), and the refusal lists what holds each slot.
- **The cooldown paces the rotation only** - a project is left alone for 30 minutes after the rotation starts something on it; a move [15] and a click are never paced.
- **The routine rotation and its order** - update tickets, triage the quick wins, triage the consensual work, plan tickets, in that order, per project, minus what is switched off, advancing only on a start that took.
- **The maintenance sweep is paced by the calendar** - when due it outranks the rotation, but only on a rotation turn, and it stamps its own schedule instead of moving the rotation.
- **Closing out what an earlier look started** - before deciding, finished agents have their routine lock released and a claim they abandoned freed, each with bounded retries; a run still going holds the rotation's turn.
- **Planning fans out, one agent per ticket** - the one rotation routine that fans out: each agent is pinned to one claimed ticket, and a batch that could claim nothing falls back to a single unpinned agent.
- **Triage takes a routine lock** - the two triage routines are taken as `routines/<name>.lock.md` before they start, so they run once across machines, and stand down when the lock is alive.
- **Starting, and stopping** - the first refused start ends the batch, claims of agents that never started are released, and a stopped daemon spawns nothing more.
- **"Run now": a look a person asked for** - runs with the preference off and without the cooldown, scoped to one project or one routine; the queued work's row starts an agent on the queue whether or not the branch moved.
- **What the last look reports** - the dashboard shows whether the preference was on, when the look ran, when the next is due, and one sentence per project; the log gets a stand-down only when it is news.
- **The routines** - the queued work is the command skill `work-queue`; the rest are built from the presets: name, prompt, label and tooltip come off the preset; what a routine does (works the queue, fans out, takes a lock, auto-merges) is declared on the routine, never matched by name.

## Business logic

### What the daemon reads

#### Context

**Problem**: the daemon used to read the agent queue [5] through the queue skill's library, claim tickets through the tickets skill's, and tell each agent which entry to work. That made the daemon depend on both skills and their file formats. A daemon that knows no skill can only watch the one thing every skill writes: the `agent-data` branch [11].

#### Business logic

On every look [1], for every project, the daemon reads the local head of the project's `agent-data` branch, after its own pull of that branch has run (the pull is `daemon-services.ts`'s). A project whose branch cannot be read stands down with "the agent-data branch could not be read, so there is no way to tell whether anything moved". When the head differs from the head remembered at the last look, the daemon counts the commits between the two that carry no `Daemon:` trailer (the counting is `daemon-writes.ts`'s); one or more is a move [15]. The new head is remembered either way. A move stays remembered until the queued work [4] is started for it, however many looks pass; a rotation start does not spend it.

### A move starts the queued work

#### Context

See `## Context`.

#### Business logic

A project whose branch moved [15] starts one agent [6] told `/work-queue`, the command skill [22] shipped as the `@gemstack/skill-work-queue` package and linked into every checkout the daemon makes (`daemon-runtime.ts`), unattended [16], with its handoff [18] at `merge`, since what it implements has already been triaged onto the queue where a human could have vetoed it. One agent per move, however high the concurrency cap: the next start needs the branch to move again, which the agent's own commits do. The start spends the move and the rotation's turn alike: whether the queue wants refilling is for this run to find out. A commit the daemon wrote itself is not a move: the run's record the daemon writes at teardown, a routine lock [10] it takes or drops, a claim [9] it mints for a plan agent all carry the trailer, on this machine and on every other machine running the daemon, so a record never starts the next run and two daemons on one branch never fire empty runs at each other's records. A person's writes from the dashboard — queue an entry, release a claim — carry no trailer and are moves: a person asking for work is exactly what should start a run.

### The chain, and after an empty run the rotation

#### Context

**Problem**: three tasks queued at once must all be worked without the daemon reading the queue to see that more remain; and the rotation that invents work must not run while queued work is still being worked, nor stop forever once it has.

#### Business logic

Every run this loop started is closed out at the next look [1] (see "Closing out what an earlier look started"). When every run of this loop on the project has ended and the branch did not move [15] meanwhile, the last run found nothing queued: the project is owed a rotation turn. While any run of this loop is still going, no turn is owed: its commits may yet arrive. A move takes precedence over an owed turn: the queued work [4] runs first, and its run decides again. So the chain [24] runs as long as each run moves the branch, the rotation resumes once a run does not, and a rotation run that moved nothing hands the turn to the next routine [7] — the idle cycle a daemon has always run, at the cooldown's pace. A move while the queued-work routine is switched off is a rotation turn instead: switching it off means "do not work the queue", and the rotation does not work it; triage and planning put entries on it, and standing down there would make every inventing routine unreachable for as long as the queue had anything on it.

### The first look, and the heartbeat

#### Context

**Problem**: a daemon that just started has no head to compare against, and firing a run per project on every restart would spend a run finding an empty queue each time; but a move the daemon never saw — a restart between a push and the look, a range git could not walk — must not be lost for good.

#### Business logic

The first look at a project remembers the branch's head and starts nothing on the queued work [4]. It does take the rotation's turn, as a daemon started with the setting already on has always done at start-up rather than sitting idle with quota to spare. The heartbeat [23]: when a day has passed since the queued work was last started on a project — counted from the first look, so the first heartbeat is a day after the daemon started — the queued work runs as if the branch had moved.

### When unattended work may start

#### Context

See `## Context`.

#### Business logic

A look [1] first reads the Auto PM [3] preference once, so the toggle takes effect without a restart. Off, or unreadable, ends the look before any project is visited, unless the look is a "Run now". Then it reads the projects; a list that could not be read is empty and ends the look. It re-reads, once per look, the routines [7] the user switched off and the concurrency setting, so a change mid-schedule holds for the projects still to come.

For each project, once the branch has been read and the finished runs closed out, the look decides what the turn is for: the queued work [4] when the branch moved [15] or the heartbeat [23] is due; else the rotation when a turn is owed, or on a plain "Run now"; else nothing, recorded as "nothing moved on the agent-data branch since the last run". Then the conditions are checked in this order, cheapest first, and the first that holds stands the project down with its sentence:

- Auto PM is off: "auto PM is off".
- The project already has as many agents [6] live as the concurrency cap allows: the refusal described under "The concurrency cap names its slots". A move stays remembered, so the queued work starts once a slot frees.
- The turn is the rotation's and the rotation started something on this project less than the cooldown ago: "a run was started for this project a moment ago". A "Run now" skips this condition, and so does the queued work.
- The quota [2] could not be read, or a quota window is at or past the boundary: the refusals described under "The quota boundary fails closed".

A stand-down is recorded for the dashboard with its reason, and logged as "auto PM: standing down for <project path> — <reason>" only when the reason differs from the last one said for that project, so a stand-down that holds for a day is one line rather than a line a minute; a start is always logged.

### The quota boundary fails closed

#### Context

**Problem**: the quota boundary [8] is the share of the quota week elapsed so far, rising continuously with the clock, moved by the user's spend offset [12]. Work the user asks for may cross it and borrow against the days still to come; work nobody asked for is exactly what the line exists to stop. Quietly burning a subscription on unasked work is a worse failure than skipping a look [1], so, unlike the per-agent guard that never stops the user's own work when the quota [2] cannot be read, this check refuses. The reading is the account's own week as the coding agent [13] reports it, absolute and complete, so a daemon that just restarted is not blind to what the account already spent. How a reading is measured against the boundary lives in `quota-boundary.ts`.

#### Business logic

- No reading at all: "the quota could not be read, so there is no way to tell what is spare".
- The reading is asked per project rather than once per look: the model a project's work would run on is a project-level setting, and the model's own weekly window binds alongside the account's, so two projects on two models can stand at two different places against the same reading.
- When a window is at or past the limit in force, the refusal names the window and the line it stopped at: "<window label> is <used>% used, at or past day <day> of the week's <boundary>%" when the spend offset is zero, and "<window label> is <used>% used, at or past day <day> of your <limit>% limit (<offset> on the week's <boundary>%)" otherwise. Percentages are whole numbers; the offset carries its sign and one decimal, since a dragged slider stores whole numbers but the default half-day cushion is 100/14. Naming the line is what keeps a user whose slider is moved from hunting for a bug that is a setting.
- Otherwise there is headroom and the look goes on.

### The concurrency cap names its slots

#### Context

**Problem**: the point of the cap is that Auto PM [3] may overlap work; a cap of one would leave the fan-out [14] invisible until someone finds the control. A cap reached by a process the dashboard's Agents panel no longer shows looks exactly like one reached by real work, so a bare number cannot be questioned; a named slot can be looked up.

#### Business logic

- The cap is the concurrency setting, re-read every look [1]. Unset or unreadable means 2, never 1: the absence of the setting has never meant "less". Fractions are rounded down, and the result is never below 1, since zero agents is what switching Auto PM [3] off is for.
- Every agent [6] live on the project counts against it, whoever started it.
- At the cap, the refusal is "<n> run is already going" or "<n> runs are already going", followed by the labels of the live agents in parentheses, each label being the agent's id and process id as the daemon holds them; when the cap is above 1 the sentence continues ", and the routine keeps at most <cap> at once". At a cap of 1 the wording stops after the names.
- The cap holds for a "Run now" too: it is what keeps a second click from doubling up, since a start registers before the look moves on.
- A plan batch is sized to the room left: the cap minus the agents live on the project. The queued work [4] is one agent per move [15]; with room under the cap, the next move — the first agent's own claim — starts one more alongside it.

### The cooldown paces the rotation only

#### Context

**Problem**: the rotation invents work on an idle project, and without a pause it would fire a routine [7] every look [1]. A move [15] of the branch is different: someone, or an agent, asked for that run, and the daemon firing again as a run ends is the chain [24] itself.

#### Business logic

- A project is left alone for 30 minutes after the rotation started something on it: "a run was started for this project a moment ago". Only the rotation's own starts arm it; an agent the user started counts toward the cap instead, and a start on the queued work [4] arms nothing, since its next start needs the branch to move again, which is a better guard than a clock.
- The cooldown is armed before the first spawn of a batch and once for the whole batch: starting is slow, and a look overlapping the spawns would otherwise see too few live agents and top up past the cap. When the batch started nothing, the cooldown is given back, so a project is not stranded for half an hour by a start that spent nothing.
- A "Run now" ignores the cooldown: the cooldown paces work nobody asked for, and a click is asking. Every other reason to stand down still holds.

### The routine rotation and its order

#### Context

**Problem**: the rotation is a cycle whose order matters. Importing leads because it is the only routine [7] that can add a ticket none of the others has seen; without it a rotation that triages and plans a set nothing refills eventually has nothing to do, and a new GitHub issue would wait for a human to press a button. Triage turns tickets into queued work. Planning is the most expensive turn and the one whose output the earlier routines consume, so it runs last. No separate scheduler exists or is needed: the rotation fires after every run that found nothing queued, which is exactly when the queue wants refilling.

#### Business logic

- The order: "Update from GitHub" (`update-tickets`), "Add quick-win work to AI Queue" (`triage-quick`), "Add consensual work to AI Queue" (`triage-consensual`), "Plan tickets (aka spike)" (`plan-tickets`). Importing is safe to repeat: the preset resumes from where the last import stopped and reconciles, so a firing with nothing changed is a no-op rather than a re-import.
- The position in the cycle is kept per project, so two projects idle at once each work through the whole rotation rather than taking alternate halves of it. Nothing of it survives the daemon.
- The routines the user switched off are removed from the cycle before the position is applied, so with two of four off the remaining two alternate instead of every other turn landing on a routine that cannot run. The switched-off list is re-read every look [1], and a list that cannot be read means none is off: a preference that cannot be read must not silently switch the whole rotation off.
- The position advances only when a start took, so a refused start is retried rather than skipped, and only for a rotation routine fired by the rotation itself: the queued work [4], the maintenance sweep and a routine a click named all leave it where it is. A planning turn that finds nothing left to plan also advances it, because that is the routine's work being done rather than refused, unless a click named the routine.
- When every routine that makes new work is switched off, the project stands down with "every routine that makes new work is switched off"; a daemon wired with no routines at all says "there is no job to run". The two are told apart on purpose: the first is a setting the user can see and undo.
- No routine may end at a gate [17]: the "Suggest tickets to work on" preset, which stops to ask, is deliberately not a routine, since firing it unattended [16] would park an agent [6] against a human who will never answer, and no routine's prompt may contain a gate.

### The maintenance sweep is paced by the calendar

#### Context

**Problem**: the "Maintenance" preset looks at the codebase's standing history rather than at new tickets, so a rotation that cycles after every empty run is the wrong pacing for it. It is paced by a calendar kept in the project's checkout (the schedule lives in `maintenance.ts`), so a project that adopted The Framework late gets its pre-existing history looked at, an interval at a time.

#### Business logic

- When due, the maintenance sweep outranks the rotation: the entries it queues are what the rotation would otherwise be inventing work instead of. It fires only on a rotation turn — never on a move [15], which has plenty to do — never on a "Run now" that named a routine [7], and never while the maintenance routine is switched off.
- The switch is checked before the schedule is read, so a switched-off maintenance sweep costs no disk read and leaves its calendar untouched: it comes due normally once switched back on, rather than having been silently ticked past while off. A schedule that cannot be read means "not due", so the rotation keeps running rather than sweeping on every turn.
- Its firing does not advance the rotation. Instead the project is stamped as swept once the start took, so the next maintenance sweep is an interval away; a start the daemon refused is retried on the next look [1] rather than postponed a whole interval.
- Its prompt covers the entire codebase, and its start is reported as "sweeping the codebase for maintenance work".

### Closing out what an earlier look started

#### Context

**Problem**: a claim [9] minted for a plan agent [6] is normally lifted by that agent's own pull request. An agent that ended with no commits never opens one, so its claim would stand until a human clicks "Release", and the planning would livelock on the dead claim, respawning the same work every cooldown. The look [1] is the one place that knows both which agents it started and how they ended, so it frees exactly the claims it minted, keyed off the recorded ending and never off a timer. And whether the queue wants refilling is known only once every run this loop started has ended.

#### Business logic

Before deciding, every agent this loop started on the project and has not yet been closed out is looked at. The daemon reads the agent's status and recorded ending (`daemon-services.ts`); the look decides what to do with the answer:

- Still running: kept for the next look, and the rotation's turn waits.
- Ended cleanly, but its handoff [18] has not reported yet: an agent carrying a claim is held for at most two more looks rather than closed out blind, since the ending is the one fact the release keys off. Past that bound it is closed out unread, so a process that died mid-handoff cannot hold its claim forever.
- Ended with nothing to hand off, carrying a claim minted here: the claim is freed by the look itself, and only the exact minted claim; a lock naming anyone else is left alone. The ticket is remembered as having ended dry before the release is attempted, and is not offered again for the rest of the daemon's life: a task that deterministically ends without commits would otherwise burn a quota [2] run every cooldown, forever. A daemon restart forgets the set and allows one more try, on the assumption that a human retired or reshaped the ticket in between. A release that could not land, a transient git lock for instance, is retried on the next look, at most twice.
- Held a routine lock [10]: the lock is released whatever the ending, since no pull request of the agent's ever will; a release that could not land is retried, at most twice.
- Once none is left pending and the branch did not move [15] since the last start, the project is owed a rotation turn (see "The chain, and after an empty run the rotation").
- On a project's first look after the daemon started, the routine locks a previous daemon on this machine left behind whose agents are gone are released once, since nothing else would ever release them.

### Planning fans out, one agent per ticket

#### Context

**Problem**: the stock planning prompt covers every ticket that has no plan or claim [9] yet, and with a batch going out that instruction is a collision: every agent [6] forks the same checkout [19] and picks the same most-important ticket. Planning is the one rotation routine [7] that may fan out [14], because it writes each ticket's own sibling files rather than rewriting the shared queue document, so concurrent copies do disjoint work and land disjoint edits. Every other rotation routine rewrites the whole queue from the same fork point, and two at once would revert each other's edits, so those stay one agent per look [1]. This is the one place the daemon still reads and claims tickets; its own design is a follow-up.

#### Business logic

- The candidates are the tickets with neither a plan nor a claim, most important first (the daemon reads them off the `agent-data` branch [11]), minus the tickets pinned to planning agents still in flight and minus those whose planning agent already ended dry. A list that cannot be read means no candidates.
- No candidates stands the project down with "every open ticket already has a plan, or an agent on the way to one", and the rotation advances: nothing left to plan is the routine's work being done, not a refusal, so the next turn tries the next routine instead of re-asking forever. A "Run now" that named the routine advances nothing.
- The batch is the first candidates, as many as the cap has room for. Agent ids [20] are minted first, from the clock; then the claims are written as one batch and pushed, one `.lock.md` per ticket reading `CLAIMED: <agent id>`, so agents forked from any checkout, and cloud sessions in particular, find the file and skip the ticket. Only the tickets actually claimed get an agent: a ticket lost to a race costs one agent of the batch, not the batch. When nothing could be claimed, or the daemon has no way to claim, one unpinned stock agent runs, which is safe without a claim.
- The pin is appended to the stock prompt rather than spliced into it, so the verdict rules the preset carries ride along verbatim and a rewritten preset cannot silently lose the pin: "You are one agent of a concurrent batch, so the scope above narrows: plan exactly one ticket, `tickets/<file>`, and no other." Then the claim contract: the ticket "is already claimed for you", `tickets show <file>` names the agent as its holder [21], the agent writes the plan with `tickets put <stem>.plan.md` and lifts its claim with `tickets release <file>`, because the plan is a write to the `agent-data` branch and not a pull request; a ticket not claimed, claimed by someone else, or already planned "is not yours — stop and do nothing". Nothing else releases the claim: a forgotten one stands until a human clicks it away.
- The start is reported as 'planning "<ticket file>"'.

### Triage takes a routine lock

#### Context

**Problem**: the two triage routines [7] rewrite the shared agent queue [5] and may take hours; two at once, on any machine sharing the `agent-data` branch [11], would revert each other's edits. Which routine holds a lock is declared on the routine, never matched by its name, so a rename cannot quietly unhook it.

#### Business logic

- "Add quick-win work to AI Queue" holds `routines/triage-quick.lock.md` and "Add consensual work to AI Queue" holds `routines/triage-consensual.lock.md`, each a routine lock [10] on the `agent-data` branch, written and pushed before the agent [6] starts so every machine sharing the branch sees the routine as taken.
- A lock that is alive, held by another machine's triage or by this one's still going, or that could not be written, stands the routine down with the lock's own reason and no agent started; when the taking itself fails, the reason is "the routine lock could not be taken". The rotation stays on that routine, so the next turn tries it again.
- The lock is released when the agent ends, whatever the ending, with the bounded retries described under "Closing out what an earlier look started", and released at once when the daemon refused the start, since no agent will ever release it.
- Locks a previous daemon on this machine left behind are released on a project's first look [1].
- A daemon wired without the locking seam starts the routine unguarded.

### Starting, and stopping

#### Context

**Problem**: an agent [6] spawned after the daemon has begun closing is missing from the live-agent map the daemon has by then cleared, so nothing would ever stop it. Claims [9] are pushed before the first spawn, so an agent that never starts would strand a claim no agent could ever free.

#### Business logic

- Stopping the sweep is a verdict on the whole look [1]: it is re-checked after every wait and before every spawn, and a stop mid-batch spawns none of the rest.
- Each start is logged as "auto PM: <what it does> in <project path>", where "what it does" is the routine's description line when it has one, else its label, else its name.
- The first start the daemon refuses ends the batch: whatever refused it is not going to take the next one a moment later, and a refused routine must be retried rather than skipped. It is logged as "auto PM: could not start a run in <project path>", and a routine lock [10] taken for it goes back at once.
- After the batch, the claim of every item that never started is released: those never enter the closing-out step, so nothing else would free them.
- When nothing started, the cooldown is given back and the project is recorded as "the daemon could not start a run", or as the lock's reason when a lock stood the routine down.
- When something started, the project is recorded with what: a single start keeps its own sentence; several read "started <n> agents: <sentence>; <sentence>; …". Either is followed by " alongside <m> already going (<labels>)" when agents were already live, so a batch that came out short of the cap says what it was short by.

### "Run now": a look a person asked for

#### Context

**User story**: the user clicks "Run now" on a routine's [7] row, or on the queued work's row, in the dashboard, with or without a project picked, and the look [1] runs for that at once. The same wake happens when the user switches Auto PM [3] on, so the box just ticked does not wait for the next look to do anything.

#### Business logic

- The Auto PM preference is consent to spend quota [2] unasked, and a click is asking: a "Run now" runs with the preference off. The preference is still read, so the report says where the box stood.
- It skips the cooldown. The concurrency cap, the quota boundary [8] and the switched-off routines all still hold.
- With a project picked, only that project is visited; a project id that matches nothing stands the look down rather than silently widening it to every project. Without one, every project the daemon watches is visited, which is what the queued work's row says it does.
- A plain "Run now" starts the queued work [4] when the branch moved [15], else the rotation's next routine: the click is the ask, so it does not wait for a run to have found nothing.
- The queued work's "Run now" starts one agent on the queue in each project visited, whether or not the branch moved — a run that finds nothing queued spends one run finding that out, which is what the click asked for — or says why not: "the routine that works the queue is switched off".
- A planning "Run now" fires the fan-out [14] routine of the enabled rotation, through the same claim-then-start path the rotation takes, cap included; with it switched off the look stands down with "the planning routine is switched off".
- A triage "Run now" names the routine by the lock it holds, so the lock is taken before the start; a plain start outside the sweep would run unguarded. A lock no enabled routine holds is told apart: "<label> is switched off" when the routine exists but is unticked, and "no routine holds the <lock> lock" when nothing holds it, which is a dashboard older than its daemon.
- A click that named a routine takes the turn outright: it is never the queued work however much the branch moved, never the maintenance sweep, and it moves neither the rotation's position nor the maintenance calendar, since it did not come from the cycle.

### What the last look reports

#### Context

**Problem**: every decision is logged, but the log is the daemon's terminal and the toggle lives in a browser; from the dashboard a wedged look [1] and a healthy idle one would look identical. And with a look every minute, a log line per look would drown the daemon's output.

#### Business logic

- The dashboard is told whether the preference was on at the last look, when that look finished, when the next is due, and one line per project visited, in look order: the project's path, whether an agent [6] was started, and the sentence. A start's sentence is exactly the sentence the daemon logged; a stand-down's is logged only the first time it is said for the project, until the sentence changes.
- The next look's time is counted from the moment the loop started, in whole intervals of one minute, so a "Run now" does not shift the schedule.
- The last look is recorded even when it ended early, so "switched off" and "on, and standing down for a reason" are distinguishable. Before the first look, the report carries only the next due time and no outcomes.

### The routines

#### Context

**Problem**: the dashboard lists the routines [7] and the daemon fires them; written out twice, the two would drift. What a routine does is declared as data on the routine, so a renamed preset cannot quietly unhook the behavior tied to it.

#### Business logic

- The queued work [4] is the command skill [22] `work-queue`: its name is the skill's, its prompt is the slash command `/work-queue`, its label "Work the queue" and its tooltip "Work one queued task off the agent queue, unattended." are written here, and it is declared as working the queue and as auto-merging its pull request. The skill file itself is the `SKILL.md` of the `@gemstack/skill-work-queue` package, which The Framework depends on.
- Each preset-backed routine carries the preset's stable name, which is what the rotation's position and the switched-off list key on; the prompt rendered from the preset; and the preset's label and one-line tooltip, read off the preset so a relabeled preset relabels its routine and the sentence the launcher shows for a preset and the sentence the routines list shows for its routine are the same sentence.
- Only the maintenance routine carries a separate description line, "sweeping the codebase for maintenance work", because "Maintenance" names its preset rather than the work; the other routines' labels read as what they do, so their rows stay one line and their log lines say the label itself.
- The planning routine is declared as fanning out [14]; the triage routines each declare their routine lock [10].
- The routines list, in the order a surface shows them, is derived from the same routines the daemon runs: the queued work first, because it is what happens whenever the branch moved; the four rotation routines next, because they are what happens when a run found nothing; the maintenance sweep last, as the calendar-paced exception outside both.
