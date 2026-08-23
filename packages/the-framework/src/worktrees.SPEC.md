Managing the worktrees agents leave behind on a project's disk: listing them, reclaiming one, reclaiming all of them at once, and deleting an agent outright. One implementation behind every surface that does any of it — the dashboard's buttons, the CLI, and the daemon's own worktree sweep and teardown — so a second surface is never a second behavior.

## User story

- The user notices their project directory has grown and wants to know which throwaway checkouts are still on disk, how big each one is, and which agent left it.
- The user is finished with an agent's work and clicks Remove to get the disk space back, confident that nothing is being thrown away that only exists on this machine.
- The user wants an agent gone from the dashboard entirely — its row, its replayable history, the lot.

## Glossary

- **hand-off anchor** - the commit a `web`-target agent pushed when it handed its task to the cloud session; everything that agent's local checkout could contain is contained in it.

## Business logic — TL;DR

- **The retained-worktrees list** - every checkout still on disk, newest first, each with the agent that left it, its branch, how that agent ended, and its size.
- **Only what is on the remote may go** - a checkout is reclaimed only once its work is committed and pushed, so every removal is recoverable.
- **A running agent's checkout is never taken** - removing and deleting both refuse while the agent is still going.
- **Publish-nothing agents are never published to be tidied** - an agent set to publish nothing keeps its checkout rather than having its branch pushed to make removal possible.
- **A cloud agent's empty checkout goes without a push** - when the local checkout provably holds nothing the hand-off did not already carry, it is removed without pushing.
- **Delete is the one destructive action** - it removes the agent's archive as well as its checkout, but never its branch.
- **Prune reclaims everything reclaimable and says what it left** - each checkout it could not take is reported with the reason.

## Business logic

### The retained-worktrees list

#### User story

The user's project directory has grown; they want to see which throwaway checkouts are still there, which agent each belongs to, and why one of them cannot be removed.

#### Business logic

The list is every worktree directory the project still has under `.the-framework/branches/`, newest first. Each entry names the agent that left it (the agent id is also the directory name), the branch its work landed on, how that agent ended, and the checkout's size on disk. A checkout belonging to an agent that is still going is listed too, flagged as in use rather than hidden — "what is this directory and why can I not remove it" is exactly the question the list exists to answer. That checkout's size is left blank, because sizing a tree an agent is still writing to produces a number that is already wrong by the time it is shown; a caller that only wants the rows can skip the sizing entirely.

### Only what is on the remote may go

#### User story

The user reclaims disk space without ever wondering whether they just deleted the only copy of an agent's work.

#### Business logic

Reclaiming one checkout follows a single rule: the work is committed to the agent's branch, the branch is pushed, and the checkout comes off disk only once the remote has it. Uncommitted work is committed first, because removal forces past a dirty tree — without that commit, the very diff the checkout held is what gets deleted. Pushing is attempted as part of removal rather than demanded of the caller.

Any step that does not complete leaves the checkout in place and reports why: the work could not be committed, or the branch is not on the remote. A project with no remote configured therefore never gets past this, which is the honest answer — there is nowhere for the work to be recoverable from. A checkout sitting on no branch at all is also kept.

Once removal is decided, the calling surface gets to do its own cleanup first — the dashboard stops any preview being served out of that tree — and then the checkout is removed and git's worktree bookkeeping is tidied up.

#### Rationale

This replaced three interacting rules that each asked *how did this agent end*: a clean finish removed the checkout, a failure or a stop kept it, and a merged branch reclaimed it later through two different "it landed" signals. The question that actually matters is *is this recoverable yet*. There is one failure mode now, and it is legible: the push did not land, so the checkout stays and the reason says so.

### A running agent's checkout is never taken

#### User story

The user clicks Remove on the wrong row and nothing bad happens to the agent that is still working.

#### Business logic

Both removing a checkout and deleting an agent refuse while that agent is still going, and say so. An agent's checkout is where its work is happening; Stop is how an agent is ended, not pulling the floor out from under it. A request naming an agent id that is not a well-formed one, or one that has no worktree on disk, is refused the same way.

### Publish-nothing agents are never published to be tidied

#### User story

The user set an agent's handoff to publish nothing. Cleaning up disk space must not be what finally pushes that agent's branch to the remote.

#### Business logic

An agent whose handoff level is set to publish nothing has its checkout reclaimed only when everything it holds is already on the remote by someone's explicit act — a clean tree on a branch that is already pushed. Anything short of that keeps the checkout and says why. Nothing is committed on the way to that refusal either: a kept checkout is a place someone works and the sweep re-offers it every pass, so sweeping half-typed edits into a framework commit on the way to declining is not cleanup.

The agent's own record decides this before anything is committed or pushed. A record that was never written at all — an agent that died at boot — is treated as the ordinary, recoverable case. A record that exists but cannot be read keeps the checkout, because an unreadable record cannot tell a publish-nothing agent from any other; a later pass tries again.

#### Rationale

The push exists to make removal recoverable; it is not a licence to publish. Pushing a publish-nothing agent's branch to make its checkout removable would have cleanup perform exactly the publication the agent's own handoff declined.

### A cloud agent's empty checkout goes without a push

#### User story

The user's remote never fills up with empty branches, one per task they handed to a cloud session.

#### Business logic

A `web`-target agent's local checkout never holds the work: the hand-off pushed everything the cloud session starts from, and the work itself lands on the cloud session's own remote branch. So when such an agent recorded a hand-off anchor, its tree is clean, and its branch tip is contained in that anchor, the checkout is removed without any push — it provably holds nothing. Anything short of that proof — no anchor recorded, the anchor's commit gone, a dirty tree, or a tip that moved past the anchor — falls back to the ordinary rule, which is never worse than what these agents got before.

#### Rationale

Pushing these local branches purely to satisfy the remote rule is what accreted one empty `tf-agent-<agent id>` branch on the remote per cloud agent.

### Delete is the one destructive action

#### User story

The user wants an agent gone from the dashboard for good — not just its checkout reclaimed, but its row and its replayable history too.

#### Business logic

Deleting an agent is the sibling of reclaiming its checkout, and the difference is the point. Reclaiming takes the checkout back and keeps the agent — its row and its replayable log — because the history was already archived. Deleting removes that archive as well: the agent meta that puts the row in the list and the event log that replays it, wherever they are filed. Records are found by looking them up rather than by deriving a path from the agent id, because an agent is archived under whichever user ran it. A record on the data branch is deleted inside the data branch's write cycle, so the deletion is itself a committed and pushed change; any transient copy is simply unlinked. A file that is already gone is not an error, so a half-deleted agent still finishes cleanly.

The checkout goes first, force-removed — any uncommitted work in it is discarded along with the agent, which is the intent here, unlike reclaiming, which commits that work to the branch it keeps.

What deletion deliberately leaves alone is git's, not the dashboard's: the agent branch and its commits stay. Deleting a branch that may carry merged work or an open pull request is not something a dashboard button does silently, so delete means "remove from the dashboard", not "erase every trace". Because it is the one action that destroys history, the surfaces that offer it ask for confirmation first.

### Prune reclaims everything reclaimable and says what it left

#### User story

The user wants all of it cleaned up in one go, and wants the result to account for every checkout the list showed them.

#### Business logic

Pruning walks the retained-worktrees list and reclaims every checkout whose agent is not still going, under the same rule as reclaiming one by hand. A checkout it leaves behind is reported with its reason — the agent is still running, its branch could not reach the remote, its handoff publishes nothing — so removed plus skipped always adds up to what the list showed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
