One composer for an agent, live or finished: the box stays put across its whole life, and only what a send does changes.

## Flows

- While the agent runs, a send queues the message for the agent to read between turns — and says so, since a queued message is otherwise invisible.
- Once the agent has ended with a session id to resume, a send continues that same conversation on the same branch and row, on the agent's own driver (never the global preference).
- Once it has ended without one, a send starts a fresh agent — the placeholder itself says so.
- The empty box's submit slot doubles as the agent's control: Stop while live, Resume once stopped — both latched so a landed press cannot re-fire or flicker while the state change is still in flight.
- A preset marked new-session always opens its own agent, whatever state this one is in.

## Rationales

- One composer rather than one per state: swapping boxes at the ending would remount the editor under the user and take a half-typed message with it. And a box that exists only when resuming is possible would leave an un-resumable agent a dead end.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
