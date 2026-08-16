One composer for a session, live or finished: the box stays put across the agent's whole life, and only what a send does changes.

## TLDR

- Live, a send queues a message the agent reads between turns — and says so, since a queued message is otherwise invisible. Ended with a session to pick up, a send continues that same session on the same branch and row, on the agent's own agent (never the global preference). Ended without one, a send starts a fresh session — the placeholder itself says so.
- The empty box's submit slot doubles as the session's control: Stop while live, Resume once stopped — both latched so a landed press cannot re-fire or flicker while the state change is still in flight.
- A preset marked new-session always opens its own run, whatever state this one is in.

## Rationales

- Replaced a pair of look-alike composers that swapped on run end, remounting the editor under the user mid-typing and leaving un-resumable runs a dead end.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
