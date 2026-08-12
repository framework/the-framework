Carries the shared agent work queue (`TODO_AGENTS.md`) out of a finished run's isolated branch into the project's own checkout, and works out which queue entries are already being worked on so no entry is ever handed to two agents.

## TLDR

- Runs work on their own branch — right for code, wrong for the queue: without promotion, a run's queue updates landed where nobody reads them and the automatic project manager kept re-deriving the same work forever.
- The daemon does the copying, never the agent: agents stay sandboxed, and only the one queue file is ever written and committed.
- Conservative everywhere it is not certain: anything unexpected skips and leaves the checkout untouched; a human mid-edit of the queue is the one skip retried next tick.
- A run pinned to one entry lands only that entry's check-off plus any follow-ups it queued — additive by construction (only ticks a box or appends a line), so concurrent runs compose instead of reverting each other.
- An entry stays claimed while its run is live or its pull request is open — including pull requests from other machines, read through their queue diffs — and a lookup still warming counts as claimed rather than risking a double assignment.

## Rationales

- Removing an entry is the ordinary way to retire it, so "on the run's branch but absent in the checkout" is ambiguous: the point where the run forked is what tells the run's own addition from a human's removal, and with no fork point nothing is added — resurrecting struck-off work is worse than losing a follow-up.
- A pull request's claim is read from its diff, not its whole file, so an entry that merely predates the branch's fork never counts as retired by it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
