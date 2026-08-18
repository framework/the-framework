Claims a ticket for a single agent by committing a lock file beside it and pushing to the default branch, so agents on other machines and in the cloud cannot double-work the same ticket.

## TLDR

- The claim cannot live in the daemon's memory — cloud agents outlive the local process, and other machines never shared it — so it lives where every agent already looks: a lock sibling in the tickets folder naming the holder, which the stock prompts already skip.
- The daemon writes and pushes locks, never the agent: agents push only at the end, onto their own branch, and a lock protects nothing unless it reaches the branch agents fork from before work starts.
- A batch says which side of the ticket's life it claims for: a planning batch skips a ticket that already has a plan (the work it came for is done), while an implementing batch reads the plan as its input and is stopped only by an existing lock.
- The claim is the commit: locks that never reach one are rolled back; a failed push keeps the batch (it still guards local agents) and is said out loud; the push happens only from the default branch, so a feature checkout cannot smuggle its own commits onto main.
- No timed expiry — an agent may legitimately hold a ticket for days. The lock lifts when the agent's own PR deletes it or a human releases it; a release whose commit fails puts the file back.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
