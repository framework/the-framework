Effort: 3
Uncertainty: 4

# [Plan] Improve lock mechanism

Concrete plan for the one slice of #1420 still open — drains claim tickets via queue entries instead of `.lock.md` — after the core mechanism landed in PR #1425.

## TLDR

Most of this ticket is already done and merged:

- **PR #1425 (merged 2026-07-31)**: the daemon writes, commits, and pushes `tickets/<STEM>.lock.md` (`CLAIMED: <AGENT_ID>`) before plan agents start (`ticket-locks.ts`); pinned plan agents delete the lock in the same commit as their plan; the `PENDING:` placeholders and the 6h staleness timer are fully removed; the ticket detail page has a Release-lock button for dead agents; `readTickets`/`readTicket` surface `locked`/`lockedBy`.
- **`planned-quick-wins.ts` removal**: already done separately (see the `remove-planned-quick-wins` changeset landed via the #1536 sweep) — the file no longer exists.

What remains is the follow-up PR #1425 flagged: **implementation runs (queue drains) still claim work through queue-entry assignments** — the sweep's in-memory `pending` map plus the entry riding on the agent's meta (#1253/#1204) — **not through `.lock.md`**. So the phase-agnostic, cross-machine claim the ticket asks for exists only for the planning phase; two daemons on different machines can still double-book the *implementation* of the same ticket.

## Problems

1. **Ticketless queue entries** (uncertainty 3): `.lock.md` is a ticket sibling, but many `TODO_AGENTS.md` entries are self-contained TODOs with no `tickets/` file behind them. There is nothing on disk to lock for those.
2. **Lock lifecycle across phases** (uncertainty 5): the whole-life vision (ticket-locks.ts: "in Rom's design for its whole life, implementation included") suggests a ticket stays claimed from planning through implementation. But the plan agent's merge deletes the lock, and the implementing drain is a different agent assigned much later — so either the lock is re-pointed and never lifts, or it lifts at plan-merge and is re-acquired at drain assignment.
3. **Acquire semantics differ per phase** (uncertainty 2): `acquireTicketLocks` skips a ticket when its `.plan.md` exists ("a plan is someone's finished work"). For a drain that condition is inverted — the plan is the *input* — so the existing skip rule cannot be reused as-is.

## Solutions

**Problem 1 — ticketless entries:**
- (a) **Recommended**: lock only entries that link back to a ticket (`ticketFromQueueEntry`, #1164); ticketless entries keep today's entry-claim behavior. Covers exactly the cases where double-booking is expensive (tickets), costs nothing new in format.
- (b) Invent a queue-entry lock file/format for arbitrary entries — new format surface, heavy, and the queue document itself is already the coordination point for entries; not worth it.

**Problem 2 — lifecycle:**
- (a) **Recommended**: lift at plan-merge (as shipped), re-acquire at drain assignment with a fresh `drain-<ts>-<i>` id, same daemon-writes-and-pushes path. The unlocked window in between is triage-mediated (a human or triage puts the entry on the queue), and assignment is daemon-serialized — the window the lock exists to close (two agents *starting* on the same work) stays closed.
- (b) Never lift between phases: plan agent keeps the lock, daemon rewrites the holder at drain time. Matches the whole-life vision more literally, but contradicts "the lock lifts when your work lands", makes a plan-only ticket (never queued for implementation) locked forever, and complicates the Release button story. Defer this to the larger single-coordinator architecture direction — it is a separate design, not a lock-mechanism patch.

**Problem 3 — acquire semantics:**
- Add a phase parameter (or a second entry point) to `acquireTicketLocks`: drain mode skips only on an existing `.lock.md`, not on `.plan.md`. Everything else (batch commit, rollback on failed commit, best-effort push, race-skip) is reused unchanged.

## Implementation

1. **Sweep** (`auto-pm.ts`, drain branch of the tick, ~L721): after picking the open entries for the batch, map each to its ticket via `ticketFromQueueEntry`; build `{ticket, agentId: drain-<now()>-<i>}` assignments for the ticket-linked ones and pass them through the `lockPlans`-style seam in drain mode. An entry whose ticket lock is lost to a race is dropped from this batch (next tick reconsiders); ticketless entries proceed exactly as today.
2. **Locks** (`ticket-locks.ts`): drain-mode acquire per Problem 3; `lockMessage` unchanged.
3. **Prompt** (`pinnedDrainJob`): when the entry has a locked ticket, append the same claim contract the pinned plan prompt carries — "your claim is `tickets/<STEM>.lock.md` holding `CLAIMED: <id>`; remove the ticket, its `.plan.md`, and its `.lock.md` in the PR that closes it (ticketing format: closed tickets leave the repo); if the lock names a different agent, stop."
4. **Readers**: nothing new — `planCandidates` already filters `locked` tickets, so a drain-held ticket is also protected from being re-planned; the dashboard badge/Release button work as-is.
5. **Tests**: drain-mode acquire (plan present ≠ skip), sweep wiring (ticket-linked vs ticketless entries, race-lost entry dropped), prompt contract, and an e2e pass over the drain story.

After this slice lands, the ticket can be closed; the larger single-coordinator ("whole-life agent") direction deserves its own ticket if pursued.
