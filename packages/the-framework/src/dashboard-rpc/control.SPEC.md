Every dashboard action that changes something: steering a live agent, starting one, and publishing or cleaning up what a finished one left.

## User Stories

- The user steers a live agent: Stop, answer its choice card, send it a chat message, change how far it publishes itself when it finishes, arm Merge.
- The user answers the question a Claude web session is parked on, and the browser extension types the pick into claude.ai.
- The user publishes what a finished agent left: push its branch, open a pull request, merge.
- The user starts an agent and opens a checkout in their editor.
- The user removes a kept checkout, or deletes an agent for good.
- The user queues a ticket for the agents and frees a stuck ticket claim by hand.

## Flows

- When the user steers a live agent — stop, answer a choice, send a message, arm the handoff, merge — the click appends a command to the agent's own control file, which the agent watches: the same append whoever asks, no direct line into the process.
- A Claude web session has no local process to steer: the user's pick is queued for the browser extension to type into claude.ai, and only as a label of the question actually parked.
- Starting an agent and opening a checkout in an editor call straight into the daemon's own wiring: there is one host and it wires everything, so a missing capability is a wiring bug that names itself rather than a state a request can find.
- When the user publishes a finished agent — push its branch, open a PR, merge — the work it left uncommitted is committed first, and a lock is held across the commit *and* the push, since teardown publishes the same branch under the same lock: a click racing it must neither lose the work nor collide creating the ref.
- Merge is one button for two states: it steers a live agent to merge at its natural end, and merges a finished one's PR directly.
- When the user removes a kept checkout or deletes an agent, the action refuses while the agent is live, saves the work as a commit, and stops any preview serving the tree first.
- When the user queues a ticket, the entry is written straight into the project's backlog, under the ticket's priority and linking back to the ticket, so the next agent working the queue picks it up; a stuck ticket claim can be released by hand.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
