Cleans up the per-agent checkouts a project retains — one implementation behind the dashboard's buttons, the teardown and the automatic sweep, so none of them can drift.

## User Stories

- The user removes an agent's checkout — or lets the automatic sweep reclaim idle ones — and can always recover the work afterwards.
- The user deletes an agent for good: its records leave the dashboard, while its branch and commits survive.
- The user learns why a checkout stayed whenever cleanup could not reclaim it.

## Flows

- When the user removes a checkout (or the sweep reclaims one), the work is made recoverable first: whatever the checkout still holds is committed to the agent's branch, the branch is pushed, and the checkout is deleted only once the remote has it. **Only what is on the remote may go.**
- In a repo with nowhere to push, every checkout is kept.
- A session the user set to publish nothing (`handoff: local`) keeps its unpushed checkout. That decision is checked before anything commits, so such a checkout goes only when it is clean and its work is already on the remote — removing it publishes nothing.
- A web run's checkout goes without a push once it provably holds nothing: its tree is clean and its work is already inside what the hand-off pushed. Any doubt falls back to the ordinary commit-push-remove rule.
- A checkout whose session record cannot be read is kept, and a later pass retries. A record that was never written means the session died at boot, and the ordinary commit-push-remove path applies.
- There is one failure mode, and the user sees it: the push did not land, so the checkout stays and the reason says why.
- When the user deletes an agent, the deletion goes further: the agent's archived records leave the dashboard for good and uncommitted work is discarded with the checkout — but the branch and its commits stay.
- While the agent is live, both removal and deletion refuse.
- The automatic sweep offers every non-live checkout to the same rule and reports each one it could not reclaim, so a kept checkout is always accounted for.

## Rationales

- Committing and pushing before deletion means nothing local is ever the last copy of work: every removed checkout can be recreated from its branch.
- A repo with nowhere to push keeping every checkout is the honest answer rather than a special case: there is nowhere for the work to be recoverable from.
- A publish-nothing session's branch is never pushed to make removal possible: the push exists to make removal recoverable, not to publish work the session said must stay local.
- The publish-nothing decision comes before anything commits because a kept checkout is a place someone works, and grabbing their half-typed edits as a commit on the way to a refusal would repeat every sweep pass.
- A web run's checkout is the one carve-out from the push: the hand-off already pushed everything the cloud session clones at, and the work lands on the session's own remote branch, so pushing the empty local run branch would only put a dead ref on origin per web run.
- An unreadable record cannot tell a publish-nothing session from any other, so removal refuses rather than guesses.
- Retention asks one question — is this work recoverable yet — never what state the agent ended in: how an agent ended has no bearing on whether its work is safe.
- Deletion keeps the branch because silently deleting a branch that may carry merged work or an open pull request is not a dashboard's call.
- A live agent's checkout is where it is working: Stop is how an agent ends, not pulling the floor out from under it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
