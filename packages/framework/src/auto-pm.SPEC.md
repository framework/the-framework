Auto PM: the policy that decides whether the daemon may spend leftover quota on product management right now, and the recurring sweep that acts on that decision — working the agent queue down, and refilling it by triaging and planning tickets when it runs dry.

## User story

- The user's subscription allowance expires at the end of the quota week whether it is spent or not. Rather than let it lapse, the daemon works the project's own roadmap while nobody is at the keyboard.
- The user never wants unattended work to eat the allowance they were saving for their own work, so it stands down at the quota boundary.
- The user can see on the dashboard's "Routine work" card what Auto PM last decided for each project, and press Run now to make one routine happen immediately.

## Glossary

- **ended dry** - work Auto PM already gave an agent that finished without producing anything to hand off. It is not handed out again for the rest of the daemon's lifetime.
- **routine lock** - a routine's lock file on The Framework's `agents-logs` branch, naming the machine that is running that routine and since when, so no two machines run it at once. A routine declares whether it holds one.

## Business logic — TL;DR

- **Spend only what is spare** - unattended work starts only while the account is under its quota boundary, and stands down when the quota cannot be read at all.
- **The agent queue picks the job** - entries waiting means drain them; an empty queue means invent more work.
- **A rotation refills the queue** - import tickets, triage the quick ones, triage the agreed ones, then plan the rest — one routine per tick, per project.
- **Never more agents than the cap** - a per-project concurrency setting, plus a cooldown so a project is left alone for a while after an unattended start.
- **Fan-out on disjoint work only** - draining and planning can run several agents at once, each pinned to one entry or one ticket; every other routine rewrites the shared queue document and stays one at a time.
- **Claims are files, not memory** - a ticket a batch is about to work gets a pushed `.lock.md` claim before its agent starts, so another machine's daemon does not book the same ticket.
- **One triage at a time, on any machine** - a routine that rewrites the shared queue takes a routine lock before its agent starts, and the lock lifts when the run ends.
- **Land finished work before judging** - a finished agent's queue writes are promoted into the checkout first, so the emptiness check is not made against a stale queue.
- **Dead claims are freed, and their work is not re-offered** - an agent that ended without commits will never publish the work whose landing lifts its claim, so the sweep lifts it, and remembers not to hand that work out again.
- **Run now is asking, so it outranks the switch** - a click runs with the preference off and skips the cooldown, but never past the concurrency cap, a switched-off routine, or the quota boundary.
- **Every decision is on the record** - each sweep leaves one sentence per project, both in the daemon log and for the dashboard.

## Business logic

### Whether the budget allows spending unasked

#### User story

The user pays for a subscription with a weekly allowance and wants the leftover spent productively — but never wants to find, on the day they sit down to work, that unattended routines have already burned the week.

#### Business logic

Unattended work is allowed only while the account is under its quota boundary — the pro-rated share of the quota week that may be spent by now, which rises continuously with the clock. At or past that line, Auto PM stands down with a sentence naming what is exhausted, how much of it is used, which day of the week it is, and which line it stopped at: the week's own pro-rated percentage, or the user's own limit stated as an offset on it. Work the user explicitly asks for is never held back this way.

A quota that cannot be read is a refusal, not a pass: with no reading there is no way to tell what is spare.

#### Rationale

Failing closed here is deliberately the opposite of the guard on the user's own agents, which fails open on an unreadable quota so that a metering failure can never block work a person asked for. Quietly burning a subscription on work nobody asked for is the worse of the two failures.

Reading the account's own weekly window (rather than counting what this daemon has spent since it started) means a restarted daemon is not blind: the figure is absolute, and a fresh daemon does not believe the week is untouched.

### Which job a tick does

#### User story

The user wants standing work done before more work is invented — a backlog that only grows is worse than no backlog.

#### Business logic

The agent queue decides. Entries waiting means the tick drains one; an empty queue means the tick runs a routine that puts new entries on it. An agent queue that cannot be read is a refusal, because there is then no way to tell which of the two to do.

One exception keeps the inventing half reachable: if the user has switched the draining routine off, a tick that would have drained runs a rotation routine instead of standing down. Switching draining off means "do not work the queue", and triage and planning do not work it — they fill it.

#### Rationale

Draining used to be a refusal, on the reasoning that a running agent's own backlog loop would empty the queue. That loop only exists inside an agent a human started, so unattended the queue filled once and nothing ever emptied it again.

### The rotation that refills the queue

#### User story

The user wants their roadmap to keep moving without them: new issues brought in, obvious wins queued, agreed work queued, and the rest planned — in that order, so the cheap decisions happen before the expensive ones.

#### Business logic

While the queue is empty, each tick fires the next routine in a fixed cycle, tracked per project so two idle projects each work through the whole cycle rather than taking alternate halves of it:

1. Import tickets from GitHub — the only routine that can add a ticket none of the others has seen. It resumes from the last import timestamp, so firing it with nothing changed is a no-op rather than a re-import.
2. Quick triage.
3. Consensual triage.
4. Plan tickets — last, because it is the most expensive turn and the earlier routines consume its output.

The rotation advances only when a start actually took, so a routine the daemon refused is retried rather than skipped. Draining never advances it (a queue worked off over many ticks must not race the rotation forward), and neither does a routine a person named with Run now.

Both triage routines hold a routine lock while they run, so a rotation coming round while the previous triage is still in flight stands that routine down instead of triaging the same tickets twice. The rotation still advances past it, which is what is wanted: the next idle tick tries the next routine rather than retrying one that is already running.

The gated triage preset is deliberately outside the rotation: it ends at a gate, and firing it with nobody at the keyboard would park an agent against a question no one will answer.

#### Rationale

No separate scheduler exists because none is needed: the rotation fires on every idle tick where the queue is dry, which is exactly when the queue wants refilling.

### The periodic codebase-wide maintenance sweep

#### User story

A repo that adopted The Framework late has a whole history nothing has ever reviewed. The user wants that pre-existing code looked at on a calendar, not only when someone remembers.

#### Business logic

When a project is due its maintenance sweep and its queue is empty, the maintenance routine takes the tick ahead of the rotation — the rotation invents work, and a due sweep is a standing instruction to go find some. It stamps its own schedule when its agent actually starts, and never advances the rotation index, so borrowing the tick costs the rotation nothing.

Due-ness is only asked once the routine is known to be switched on, so a switched-off sweep neither costs a read nor has its calendar silently ticked past while it is off; it comes due normally when switched back on. A sweep is never run while entries are waiting on the queue: a project with work queued has plenty to do already.

### How many agents at once, and how soon again

#### User story

The user sets how many unattended agents a project may keep going. They want that number respected, and they want to understand a stand-down without suspecting a bug.

#### Business logic

A tick starts nothing while the project already has as many live agents as the concurrency setting allows (at least one; the setting is re-read every tick so a change takes effect without a restart). The refusal names the agents holding the slots and, when the cap is above one, the cap itself.

After an unattended start, the project is left alone for a cooldown period. A spawned agent takes a moment to appear in the daemon's live-agent map, and without the cooldown the next tick would see "nothing running, queue still empty" and start a second one. The cooldown is given back immediately if the batch ended up starting nothing.

#### Rationale

Naming the agents that hold the slots matters because a cap reached by a process the dashboard no longer lists looks exactly like a cap reached by real work; named, the user can go look at what it names.

### Fanning out onto disjoint work

#### User story

With the concurrency setting above one, the user expects several agents to actually work on different things — not the same ticket implemented three times.

#### Business logic

Only two kinds of work fan out, because only they touch disjoint files: draining takes one entry *off* the shared queue document, and planning writes one ticket's own sibling files. Every other routine rewrites the whole queue document from the same fork point, so two at once would revert each other's edits; those stay one agent per tick.

A fan-out fills the remaining slots up to the concurrency cap, and each agent is pinned:

- A drain agent is told the one queue entry it may work on, told not to take it off the queue (the daemon retires the entry once the agent's work lands), and told to stop and do nothing if that entry is no longer on the queue — the assignment is a snapshot, and a human may retire the entry in between.
- A plan agent is told the one ticket it may plan. The pin is appended to the preset's own prompt rather than spliced into it, so the preset's rules keep riding along verbatim and a rewritten preset cannot silently lose the pin.

Entries and tickets already pinned to an agent still in flight are not offered again, and neither is anything marked ended dry.

### Claiming tickets across machines

#### User story

The user may run The Framework on more than one machine, and hands some work to cloud sessions. Two daemons must not implement or plan the same ticket.

#### Business logic

Before a fanned-out batch starts, the sweep claims one ticket per agent through the `tickets` skill — a `.lock.md` sibling naming a holder, committed as a batch and pushed. The holder it names is the id of the agent that claim was made for, minted before the claim, and that agent is then started under exactly that id: the claim and the run are one thing, which is what lets the Tickets page name the session holding a ticket. Each pinned agent is told its ticket is already claimed for it and told to ask the skill who holds it, stopping if the ticket turns out to be unclaimed or claimed by anyone else. A plan agent lifts its own claim once it has written the plan; a drain agent closes its ticket once its work is published, which retires the ticket, its plan and its claim together. Nothing else releases a claim, because there is no staleness timer.

Claiming is per ticket, not per batch: a ticket lost to a race costs the batch one agent, not the batch. Planning skips a ticket that already has a plan or a lock; draining skips only on an existing lock, because a plan is a drain's input rather than a competing claim. A queue entry that links no ticket has nothing on disk to lock and uses the queue document itself as its coordination point.

If a start is refused, or the daemon is stopped mid-batch, the claims minted for the items that never started are released immediately — no agent exists that could ever settle them.

### Locking a routine that must not run twice

#### User story

The user wants triage fired on a schedule without two triages ever overlapping — on this machine, or on another machine sharing the same repo — and without an agent being spent to discover that it is the second one.

#### Business logic

A routine declares whether it holds a routine lock; the two triage routines do, each under its own name. The lock is taken before the agent is started and never by the agent itself. A lock already held stands that routine down with a sentence naming the machine holding it and since when, and nothing is started — this is a stand-down rather than a refusal of the sweep, so it is reported like any other.

The lock lifts when the run ends, whatever the ending: the routines that hold one land their work by writing to a branch directly and open no pull request that could carry the release. A release that could not land is retried on the next couple of sweeps, bounded so a run whose release keeps failing cannot be tracked forever — past the bound the lock stands until it expires. A lock taken for a start the daemon then refused is given back at once, since no run will ever release it. On a project's first sweep, the locks a previous daemon on this machine left behind whose runs are gone are released too — nothing else would free them before their expiry.

A routine that declares no lock never takes one, and a daemon wired without the routine-lock machinery runs every routine unguarded.

#### Rationale

The guard used to live in the triage prompts themselves — a fixed branch name the agent checked and aborted on. Once a triage stopped committing anything, that branch never reached the remote and so guarded nothing across machines, and locally every refusal was discovered by an agent that had already been started and paid for. The guard belongs to the daemon, before the start, on the branch every machine shares.

### Landing finished work before deciding

#### User story

An agent that just finished writing new queue entries must not have its work invisible to the next decision, or the daemon would decide the queue is empty and invent the same work again.

#### Business logic

Every tick first tries to promote the queue written by each agent this loop previously started: their entries live on their own branch until promoted, where the checkout cannot see them. If anything landed, the tick stops there for that project and logs it — the queue the decision would read was just changed, so that read would be stale, and the next tick decides on the fresh picture.

An agent that has finished but whose handoff has not reported yet is held for a couple more sweeps rather than settled, when it carries a claim or a pinned queue entry: the reported ending is the fact that both the claim release and the entry's removal from the queue key off, and settling blind would lose them. The hold is bounded, so a process that died mid-handoff cannot pin its entry forever.

### Freeing a claim whose agent produced nothing

#### User story

An agent given a task it turns out to have nothing to do finishes without commits. The ticket it claimed must not stay locked forever, and it must also not be handed straight back out to another agent that will do the same nothing.

#### Business logic

A claim's normal release is the agent's own pull request deleting the lock file. An agent whose handoff was skipped for having no commits is never opening one, so the sweep frees that claim itself — the one dead claim it can know is dead rather than guess by a timer. Only the exact claim it minted is freed; a lock naming anyone else is left alone. A release that could not land is retried on the next sweep, bounded like the hold above.

The work itself (the queue entry, or the ticket) is recorded as ended dry and is not offered again for the rest of the daemon's lifetime — remembered before the release is attempted, since respawning the same work is the hazard either way. A daemon restart forgets the set, which allows exactly one more try rather than forbidding the work for good.

#### Rationale

Without both halves the queue livelocks: leaving the lock standing blocks the ticket until a human clicks Release, while freeing it without remembering makes a deterministically commitless job respawn every cooldown, forever, burning a quota-funded agent per cycle.

### Run now

#### User story

The user does not want to wait for the next sweep. Each routine on the "Routine work" card has a Run now button, and the toggle that switches Auto PM on should do something immediately rather than after a whole interval.

#### Business logic

A sweep a person asked for runs even with the Auto PM preference switched off — the preference is consent to spend quota unasked, and a click is asking — and it ignores the cooldown, which exists only to pace unattended work. Everything else still holds: live agents against the cap, the quota boundary, and routines the user has switched off.

A click can narrow the sweep to the work of exactly one routine, and a narrowed sweep never borrows the click for something else:

- Draining: if the queue is empty, it says so rather than falling through to a rotation routine.
- Planning: reaches the same claim-then-start path the rotation takes, so the concurrency setting applies to the click as well.
- A routine that holds a routine lock (the triages): one agent, but routed through the sweep so the lock is taken before the start — a plain start would run the routine unlocked.

A click asks for a locked routine by the lock it holds rather than by its name, so renaming a routine cannot change the path its click takes. A click naming a routine is never turned into a drain however full the queue is, and it never advances the rotation. A click for a routine that is switched off stands down saying so, and one naming a lock no routine holds at all is told apart from that — the first is a setting the user can undo, the second means the dashboard is older than the daemon. A click may name one project, in which case only that project is visited; otherwise every project is.

### Switched-off routines

#### User story

The user wants to keep Auto PM on but silence individual routines.

#### Business logic

The routines the user has opted out of are re-read every sweep, so a routine switched off mid-sweep does not fire for the projects still to come, and a preference that cannot be read is treated as "none switched off" — an unreadable file must not silently disable everything. The rotation is filtered rather than skipped at the index, so with two of four routines off the remaining two alternate, instead of every other tick landing on a routine that cannot run.

### Reporting what the sweep decided

#### User story

The Auto PM toggle lives in a browser while the log lives on the daemon's stdout, so from the dashboard a wedged sweep and a healthy idle one looked identical.

#### Business logic

Every sweep records whether the preference was on, when it finished, when the next one is due, and one sentence per project it considered, in sweep order — the same sentence the log line carries, whether that is what was started or the reason for standing down. The next-sweep time is counted from a fixed anchor, so an out-of-band Run now cannot skew the schedule.

Sweeps never overlap: a sweep reads a live-agent picture that its own starts change, so a second sweep running over the first would decide against a stale one. A stop is a verdict on the whole sweep — the loop spawns nothing more, including mid-batch, because an agent spawned after the daemon cleared its live-agent map is one that nothing can suspend or terminate.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
