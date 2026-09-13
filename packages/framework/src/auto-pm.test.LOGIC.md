What the tests cover, for the Auto PM sweep's policy and loop. The loop is driven against a fake `agent-data` branch whose commits are either moves (a person's or an agent's) or a daemon's, and a fake start that records what was started.

**Whether a start is allowed**

- **The happy case** - a barely touched quota week allows a start.
- **The preference** - with Auto PM off nothing starts, from the decision and from the loop alike.
- **The concurrency cap** - a project at its cap is left alone with a reason that says "already going"; below the cap it is topped up rather than refused; at a cap above one the refusal names the cap ("at most 2 at once"); an unset cap means the shipped default of 2, and a cap of zero is floored at one so a hand-edited nought cannot wedge the sweep.
- **The cooldown** - a start one minute ago holds the project off, an hour ago does not; a "Run now" passes through the cooldown but still stops at the cap.

**The quota boundary**

- **Unreadable refuses** - no quota reading at all refuses with "could not be read".
- **Under, at and past the line** - under the boundary starts; at 99% used with a third of the week gone the refusal names the window, the day and the line ("99% used, at or past day 3 of the week's 32%"); meeting the boundary exactly refuses too; a fractional spend offset is said to one decimal ("+7.1"), never as fifteen digits.
- **A restarted daemon is not blind** - the reading is the account's absolute figure, so a fresh daemon refuses at 95% used.

**The trigger and the chain**

- **The first look** - remembers the head and starts nothing on the queued work; with no rotation wired it says "there is no job to run"; with one, the rotation gets its start-up turn.
- **A move starts the queued work once** - a commit no daemon wrote starts one `/work-queue` agent; the next look, with the run settled and nothing new, starts nothing.
- **A daemon's commit is not a move** - commits carrying the daemon's trailer start nothing, however many.
- **The chain** - three tasks under a cap of one: the first run's claim moves the branch but the cap holds; the run ends having closed its ticket, and the next run starts; and so on for three; the fourth finds nothing, moves nothing, and once it settles the chain stops.
- **After an empty run the rotation** - a run that settles without a move hands the turn to the rotation; a move takes it back; a rotation run that moved nothing hands the turn to the next routine.
- **Only the rotation is paced** - a move starts the queued work a minute after a rotation start; the rotation's next turn waits out the cooldown.
- **The heartbeat** - with nothing moved, the queued work starts once the heartbeat interval has passed since it last started, and not before the next one.
- **The queued work's "Run now"** - starts an agent on the queue without a move; with the routine switched off it says "the routine that works the queue is switched off".
- **A plain "Run now"** - starts the queued work when the branch moved, else the rotation's next routine.
- **The routine off, a move** - is the rotation's turn, and nothing works the queue.
- **An unreadable branch** - stands the project down naming the branch.
- **The log says a stand-down once** - the same stand-down over three looks is one log line; the report carries it every time.
- **The queued-work routine** - its prompt is the slash command of the `work-queue` skill file, which names itself, is invocable only by a person or the daemon, and tells the agent one task, commit without pushing, committed counts as published, say so and stop; it is the only routine that works the queue and the only one that auto-merges.

**The rotation**

- **The order** - update tickets, triage quick, triage consensual, plan tickets; the gated "Suggest tickets to work on" is never in it and no routine's prompt contains a gate.
- **Walking the cycle** - with the cooldown zeroed, successive empty runs walk first, second, first; a refused start retries the same routine rather than skipping it.
- **A finished run is asked about once** - each run this loop started is settled exactly once; a run still going holds the rotation's turn and the sweep reports "nothing moved".
- **Switched-off routines** - an unticked routine is filtered out of the cycle so the rest alternate; unticking every routine starts nothing and says "every routine that makes new work is switched off"; an unreadable opt-out list means none is off.

**The maintenance sweep**

- **The job** - fires the [Maintenance] preset over the entire codebase, fully rendered.
- **Its precedence** - a project that is due is swept before the rotation gets a turn; one that is not due, or whose schedule cannot be read, keeps doing the rotation; a move is worked, never swept; with the queued-work routine off, a move is a rotation turn and the sweep is not due again.
- **Its calendar** - the sweep does not advance the rotation; it is stamped only when the start took; an unticked maintenance routine leaves its calendar alone.

**Stopping and reporting**

- **A stop mid-sweep** - a sweep stopped between its readings and the spawn starts nothing, on any project; a stopped sweep does not tick again.
- **The report** - names what was started, carries the reason for a stand-down ("already going"), says when the preference was off with no outcomes, offers a next sweep before the first has run, and is not skewed by an out-of-band tick.
- **The routines list** - the queued work, the four rotation routines and maintenance, once each, the queued work first; every routine carries a label and a fully rendered prompt; only "Maintenance" describes itself.

**Naming what holds a slot**

- **The cap's wording** - names each run holding a slot ("2 runs are already going (run-a (pid 111), run-b (pid 222)), and the routine keeps at most 2 at once"); at a cap of one the old wording stands.
- **A short fan-out** - a plan batch that came out short says alongside whom ("started 2 agents alongside 1 already going (…): planning "a.md"; planning "b.md"").

**Planning fans out**

- **One locked ticket per agent** - up to the concurrency, in most-important-first order, locked in one batch before any start, each agent's prompt naming the ticket claimed for it; only the tickets the lock actually claimed go out; nothing claimed falls back to one unpinned agent; without the lock seam the job stays one per tick; a ticket a live plan run is pinned to is not offered again; nothing left to plan advances the rotation; an unreadable concurrency falls back to the default; a refused start ends the batch.
- **The pinned plan prompt** - appended to the preset's text, so its rules ride along verbatim: one ticket, `tickets show` names the holder, `tickets put` the plan, `tickets release` the claim.
- **Only "Plan tickets" fans out** - among the catalog's rotation routines; every other routine stays one run per tick however high the cap.
- **Plan "Run now"** - fans out to the concurrency in the picked project only, never works the queue however much the branch moved, stands down when planning is switched off, and costs neither the maintenance sweep nor the rotation its turn.

**Dead claims**

- **Released when the run ended dry** - a claim whose run settled with nothing to hand off is released, exactly the minted claim; the end-before-handoff gap holds the claim for at most two more sweeps, then settles unread; a ticket whose plan agent ended dry is not planned again for the daemon's lifetime; claims of a batch the start loop never reached are released; a release that could not land is retried once; a run that published, or whose pull request was already open, leaves its lock alone.

**Routine locks**

- **Taken before, released after** - a locked routine takes its lock before it starts and releases it when the run ends, whatever the ending, and may be taken again at once; a held lock stands the routine down naming its holder with no agent started; a refused start gives the lock back; a failed release is retried next sweep and the routine waits meanwhile; an unlocked routine never asks, and a loop wired without the seam starts unguarded; a previous daemon's dead locks are released on the project's first sweep only.
- **A locked routine's "Run now"** - takes the lock then starts exactly one agent; a switched-off locked routine stands the click down by its label, an unknown lock says "no routine holds the <lock> lock", and a live agent at the cap holds the click; a click never falls through to the queued work or another rotation routine, and the next scheduled sweep still gets the move it was owed.
- **Which routines lock** - the two triage routines, each by its own name, and their prompts carry no branch abort.
