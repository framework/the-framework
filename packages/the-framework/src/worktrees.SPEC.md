Cleans up the per-agent checkouts a project retains — one implementation behind the dashboard's buttons, the teardown and the automatic sweep, so none of them can drift.

## Flows

- **One rule: only what is on the remote may go.** Removing a checkout commits whatever it is still holding to the agent's branch, pushes that branch, and deletes the checkout only once the remote has it.
- A repo with nowhere to push keeps every checkout.
- A session set to publish nothing (`handoff: local`) keeps its unpushed checkout; that decision comes before anything commits, so its checkout goes only from a clean tree on a tip already on the remote, where removing it publishes nothing.
- A record that cannot be read keeps the checkout too, and a later pass retries; a record that was never written is a boot death and takes the ordinary commit-push-remove path.
- One failure mode, and it is legible: the push did not land, so the checkout stays and the reason says why.
- Deleting an agent is the other thing entirely: its archived records leave the dashboard for good and uncommitted work is discarded with the checkout — but the branch and its commits stay.
- Removal and deletion both refuse while the agent is live.
- The prune sweep offers every non-live checkout to the same rule and reports each one it could not reclaim, so a checkout that stays is always accounted for rather than silently kept.

## Rationales

- Committing and pushing before deletion means nothing local is ever the last copy of work: every removed checkout can be recreated from its branch.
- A repo with nowhere to push keeping every checkout is the honest answer rather than a special case: there is nowhere for the work to be recoverable from.
- A publish-nothing session's branch is never pushed to make removal possible: the push exists to make removal recoverable, not to publish work the session said must stay local.
- The publish-nothing decision comes before anything commits because a kept checkout is a place someone works, and grabbing their half-typed edits as a commit on the way to a refusal would repeat every sweep pass.
- An unreadable record cannot tell a publish-nothing session from any other, so removal refuses rather than guesses.
- Retention asks one question — is this work recoverable yet — never what state the agent ended in: how an agent ended has no bearing on whether its work is safe.
- Deletion keeps the branch because silently deleting a branch that may carry merged work or an open pull request is not a dashboard's call.
- A live agent's checkout is where it is working: Stop is how an agent ends, not pulling the floor out from under it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
