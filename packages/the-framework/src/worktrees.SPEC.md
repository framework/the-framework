Cleans up the per-agent checkouts a project retains — one implementation behind the dashboard's buttons, the teardown and the automatic sweep, so none of them can drift.

## TLDR

- **One rule: only what is on the remote may go.** Removing a checkout commits whatever it is still holding to the agent's branch, pushes that branch, and deletes the checkout only once the remote has it — so nothing local is ever the last copy of work, and every deletion is recoverable with `git worktree add`.
- A repo with nowhere to push keeps every checkout, which is the honest answer rather than a special case: there is nowhere for the work to be recoverable from.
- A session set to publish nothing (`handoff: local`) keeps its unpushed checkout the same way: the push exists to make removal recoverable, not to publish work the session said must stay local. That decision comes before anything commits — a kept checkout is a place someone works, and grabbing their half-typed edits as a commit on the way to a refusal would repeat every sweep pass — so its checkout goes only from a clean tree on a tip already on the remote, where removing it publishes nothing.
- A web run's checkout is the one carve-out from the push: the hand-off already pushed everything the cloud session clones at, and the work lands on the session's own remote branch — so pushing the empty local run branch would only put a dead ref on origin per web run. It goes without a push once it provably holds nothing (a clean tree whose tip is inside what the hand-off pushed); any doubt falls back to the ordinary rule.
- A record that cannot be read keeps the checkout too: "no record was ever written" is a boot death and takes the recoverable default, but unreadable cannot tell a publish-nothing session from any other, so removal refuses rather than guesses and a later pass retries.
- One failure mode, and it is legible: the push did not land, so the checkout stays and the reason says why. It replaced a retention policy that asked what state the agent ended in, which is a question with three answers and no bearing on whether the work is safe.
- Deleting an agent is the other thing entirely: its archived records leave the dashboard for good and uncommitted work is discarded with the checkout — but the branch and its commits stay, because silently deleting a branch that may carry merged work or an open pull request is not a dashboard's call.
- Both refuse while the agent is live: Stop is how one ends, not pulling the floor out from under it.
- The prune sweep offers every non-live checkout to the same rule and reports each one it could not reclaim, so a checkout that stays is always accounted for rather than silently kept.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
