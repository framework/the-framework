Every dashboard action that changes something: steering a live agent, starting one, and publishing or cleaning up what a finished one left.

## TLDR

- Steering (stop, answer a choice, send a message, arm the handoff, merge) appends a command to the agent's own control file, which the agent watches — the same append whoever asks, no direct line into the process. A Claude web session has none to steer: its answer is queued for the browser extension to type in, and only as a label of the question actually parked.
- Starting an agent, previews, and opening a checkout in an editor call straight into the daemon's own wiring: there is one host and it wires everything, so a missing capability is a wiring bug that names itself rather than a state a request can find.
- Publishing a finished agent — push its branch, open a PR, merge — first commits what it left uncommitted, and holds a lock across the commit *and* the push, since teardown publishes the same branch under the same lock: a click racing it must neither lose the work nor collide creating the ref. Merge steers a live agent to merge at its natural end, and merges a finished one's PR directly.
- Removing a kept checkout or deleting an agent refuses while it is live, saves the work as a commit, and stops any preview serving the tree first.
- Queueing a ticket writes the project's backlog directly, under the ticket's priority and linking back to it; a stuck ticket claim can be released by hand.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
