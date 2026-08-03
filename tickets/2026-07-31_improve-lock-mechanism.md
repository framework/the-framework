Status: open
Priority: 9
GitHub: [#1420](https://github.com/gemstack-land/the-framework/issues/1420)

# Improve lock mechanism

## TLDR

Broaden the ticket lock so a ticket is assigned to a single agent regardless of phase (planning or implementation): a `tickets/<DATE>_<SLUG>.lock.md` containing `CLAIMED: <SESSION_ID> (<SESSION_NAME>)`. The claim must be on **main before work starts**, so the daemon writes and pushes it at assignment time (the agent can't: it pushes at session end, on its own branch). The old `PENDING:` mechanism and its time-based expiry are removed — no lock-retrieval; agents mustn't hang, and the user watches over the AI queue. Built in draft PR #1425: daemon writes/pushes `.lock.md`, agents delete the lock in the same commit as their plan, PENDING + the 6h timer fully removed, plus a Release-lock button on the ticket page for dead agents. Remaining follow-ups flagged there: `planned-quick-wins.ts` still reads the old Effort/Consensus keys — agreed it's dead and can be removed — and drains still claim via queue entries rather than `.lock.md`.

## Why it matters

Needed for proper spiking & planning — highest-prio (#1334/#1327): without a phase-agnostic claim visible on main, two agents can double-book a ticket (a prompts-only lock and the daemon's old PENDING locks can't see each other). Time-based expiry is wrong by design: the assigned agent acts as coordinator and can legitimately live for days or weeks (queued sub-agents may be instantiated much later).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1420](https://github.com/gemstack-land/the-framework/issues/1420), created 2026-07-31, label: `highest-prio 🌟`, 7 comments.
