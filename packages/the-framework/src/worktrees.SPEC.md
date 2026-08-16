Cleans up the per-agent checkouts a project retains — one implementation behind the dashboard's buttons, the teardown and the automatic sweep, so none of them can drift.

## TLDR

- **One rule: only what is on the remote may go.** Removing a checkout commits whatever it is still holding to the agent's branch, pushes that branch, and deletes the checkout only once the remote has it — so nothing local is ever the last copy of work, and every deletion is recoverable with `git worktree add`.
- A repo with nowhere to push keeps every checkout, which is the honest answer rather than a special case: there is nowhere for the work to be recoverable from.
- One failure mode, and it is legible: the push did not land, so the checkout stays and the reason says why. It replaced a retention policy that asked what state the agent ended in, which is a question with three answers and no bearing on whether the work is safe.
- Deleting an agent is the other thing entirely: its archived records leave the dashboard for good and uncommitted work is discarded with the checkout — but the branch and its commits stay, because silently deleting a branch that may carry merged work or an open pull request is not a dashboard's call.
- Both refuse while the agent is live: Stop is how one ends, not pulling the floor out from under it.
- The prune sweep offers every non-live checkout to the same rule and reports each one it could not reclaim, so a checkout that stays is always accounted for rather than silently kept.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
