One composer for an agent, live or finished: the box stays put across its whole life, and only what a send does changes.

## TLDR

- Live, a send queues a message the agent reads between turns — and says so, since a queued message is otherwise invisible. Ended with a session to pick up, a send continues that same conversation on the same branch and row, on the agent's own driver (never the global preference). Ended without one, a send starts a fresh agent — the placeholder itself says so.
- The empty box's submit slot doubles as the agent's control: Stop while live, Resume once stopped — both latched so a landed press cannot re-fire or flicker while the state change is still in flight.
- A preset marked new-session always opens its own agent, whatever state this one is in.

## Rationales

- Replaced a pair of look-alike composers that swapped when the agent ended, remounting the editor under the user mid-typing and leaving un-resumable agents a dead end.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
