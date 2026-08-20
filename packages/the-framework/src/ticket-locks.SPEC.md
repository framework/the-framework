Claims a ticket for a single agent by committing a lock file beside it on the data branch, so agents on other machines and in the cloud cannot double-work the same ticket.

## Flows

- A claim is a lock sibling in the tickets folder naming the holding agent — the place every agent already looks, and a file the stock prompts already skip.
- A lock is one more data-branch write: the shared write funnel syncs, commits the batch, and pushes the branch, so a claim reaches every machine the way all framework data does — and a lost push race re-judges the batch against what actually landed instead of overwriting anyone's claim.
- A batch says which side of the ticket's life it claims for: a planning batch skips a ticket that already has a plan (the work it came for is done), while an implementing batch reads the plan as its input and is stopped only by an existing lock.
- The claim is the committed state: a batch whose cycle failed whole claimed nothing, while one that committed but could not push still guards local agents and says so out loud.
- There is no timed expiry. The lock lifts when the agent retires it on the data branch with its finished work, when a human releases it, or when the daemon frees a claim it made for an agent that ended with nothing to hand off. The daemon only ever frees a lock still naming the exact agent it made it for.

## Rationales

- The claim cannot live in the daemon's memory: cloud agents outlive the local process, and daemons on other machines never see it — a committed file is what every machine and every agent shares.
- No timed expiry because an agent may legitimately hold a ticket for days, and a lock released under a live agent re-opens the exact double-work window it exists to close; an agent that ended with nothing to hand off is the one claim the daemon can know is dead rather than guess by a clock.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
