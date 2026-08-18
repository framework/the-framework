Carries the shared work queue (`TODO_AGENTS.md`) out of a finished agent's isolated branch into the project's own checkout.

## TLDR

- Agents work on their own branch — right for code, wrong for the queue: without promotion, an agent's queue updates landed where nobody reads them and the automatic project manager kept re-deriving the same work forever.
- The daemon does the copying, never the agent: agents stay sandboxed, and only the one queue file is ever written and committed.
- Conservative everywhere it is not certain: anything unexpected skips and leaves the checkout untouched; a human mid-edit of the queue is the one skip retried next tick.
- An agent pinned to one entry lands only that entry's check-off plus any follow-ups it queued — additive by construction (only ticks a box or appends a line), so concurrent agents compose instead of reverting each other.
- The queue file is the record of what is left: an entry someone is working is taken off it by that agent's own pull request, so nothing has to re-derive who holds what. A third claim mechanism used to be assembled here at read time — from agent records, their pull requests, and the queue diffs of open pull requests on other machines — which is a guess rather than a claim anyone wrote down.

## Rationales

- Removing an entry is the ordinary way to retire it, so "on the agent's branch but absent in the checkout" is ambiguous: the point where the agent forked is what tells its own addition from a human's removal, and with no fork point nothing is added — resurrecting struck-off work is worse than losing a follow-up.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
