Managing the worktrees agents leave behind on a project's disk: listing them, reclaiming one, reclaiming all of them at once, and deleting an agent outright. One implementation behind every surface that does any of it — the dashboard's buttons, the CLI, and the daemon's own worktree sweep and teardown — so a second surface is never a second behavior.

## User story

- The user notices their project directory has grown and wants to know which throwaway checkouts are still on disk, how big each one is, and which agent left it.
- The user is finished with an agent's work and clicks Remove to get the disk space back, confident that nothing is being thrown away that only exists on this machine.
- The user wants an agent gone from the dashboard entirely — its row, its replayable history, the lot.

## Glossary

- **hand-off anchor** - the commit a `web`-target agent pushed when it handed its task to the cloud session; everything that agent's local checkout could contain is contained in it.
- **birth branch** - the `tf-agent-<agent id>` branch an agent's checkout is created on, before the agent has picked a session name.

## Business logic — TL;DR

- **The retained-worktrees list** - every checkout still on disk, newest first, each with the agent that left it, its branch, how that agent ended, and its size.
- **A directory that is not a git worktree is left alone** - a directory under `.the-framework/branches/` that git does not know as a checkout of its own is refused before a single git command runs in it.
- **Only what is on the remote may go** - a checkout is reclaimed only once everything it holds is on the remote — committed and pushed, or already there — so every removal is recoverable.
- **A running agent's checkout is never taken** - removing and deleting both refuse while the agent is still going.
- **Publish-nothing agents are never published to be tidied** - an agent set to publish nothing keeps its checkout rather than having its branch pushed to make removal possible.
- **A cloud agent's empty checkout goes without a push** - when the local checkout provably holds nothing the hand-off did not already carry, it is removed without pushing.
- **A branch that holds nothing goes with the checkout** - a framework-minted branch whose tip the remote already has under another name is deleted along with the checkout instead of being pushed.
- **A birth branch the agent walked away from goes too** - when the checkout ended on another branch that contains it, the `tf-agent-<agent id>` branch is deleted with the checkout.
- **Delete is the one action that destroys history** - it removes the agent's archive as well as its checkout, but never a branch.
- **Prune reclaims everything reclaimable and says what it left** - each checkout it could not take is reported with the reason.

## Business logic

### The retained-worktrees list

#### User story

The user's project directory has grown; they want to see which throwaway checkouts are still there, which agent each belongs to, and why one of them cannot be removed.

#### Business logic

The list is every worktree directory the project still has under `.the-framework/branches/`, newest first. Each entry names the agent that left it (the agent id is also the directory name), the branch its work landed on, how that agent ended, and the checkout's size on disk. A checkout belonging to an agent that is still going is listed too, flagged as in use rather than hidden — "what is this directory and why can I not remove it" is exactly the question the list exists to answer. That checkout's size is left blank, because sizing a tree an agent is still writing to produces a number that is already wrong by the time it is shown; a caller that only wants the rows can skip the sizing entirely.

### A directory that is not a git worktree is left alone

#### User story

A checkout was removed by hand and something later recreated the directory. The user's own repository must not be committed to, pushed, or have a branch deleted because of what is left under `.the-framework/branches/`.

#### Business logic

Before any git command is run in a checkout's directory, that directory is confirmed to be the root of a git checkout in its own right. A directory that is not one is refused, reported as not being a git worktree and left exactly where it is: nothing is committed, pushed or deleted through it, and it is never removed from disk.

#### Rationale

Git answers for any directory *inside* a repository, so a leftover directory under `.the-framework/branches/` makes every command run in it act on the enclosing repository instead — the user's own checkout, on the user's own branch. That is what once had the sweep read an agent's branch as the user's `main`, try to commit the user's working tree and push the user's `main`, and judge that branch for deletion. The one question that tells a real checkout from a leftover directory is whether git's top level is that very directory, and every user of a `.the-framework/branches/` path asks it.

### Only what is on the remote may go

#### User story

The user reclaims disk space without ever wondering whether they just deleted the only copy of an agent's work.

#### Business logic

Reclaiming one checkout follows a single rule: the checkout comes off disk only once the remote has everything it holds — its tree clean, its branch pushed. Nothing is committed on the agent's behalf: a checkout holding uncommitted work is kept, and says so, until a person commits or deletes it — removal forces past a dirty tree, so removing it would delete the very diff it held. Pushing is attempted as part of removal rather than demanded of the caller.

The cases below where nothing is pushed do not bend that rule, they satisfy it early: each is a case where the remote provably holds everything the checkout does already, so there is nothing left to push.

Any step that does not complete leaves the checkout in place and reports why: the checkout holds uncommitted work, or the branch is not on the remote. A project with no remote configured therefore never gets past this, which is the honest answer — there is nowhere for the work to be recoverable from. A checkout sitting on no branch at all is also kept.

Once removal is decided, the calling surface gets to do its own cleanup first — the dashboard stops any preview being served out of that tree — and then the checkout is removed and git's worktree bookkeeping is tidied up. Any branch that goes with it is deleted last, after the checkout is off disk, because git refuses to delete a branch a checkout still has out. Removing a checkout reports which branches went with it, if any, so no surface has to say "removed" without saying what was removed.

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

### A branch that holds nothing goes with the checkout

#### User story

An agent that commits nothing on its own branch — a triage, whose only output is the agent queue and therefore lands on the data branch, or an agent stopped before its first commit — must leave neither a branch on the remote nor one on the user's machine.

#### Business logic

A checkout whose branch provably holds nothing the remote lacks is removed without any push, and that branch is deleted along with it. "Holds nothing" means two things together: the tree is clean, and the branch tip is reachable from some remote-tracking branch *other than the branch's own copy* — a commit the remote already has under another name. The branch is then not the last copy of anything by construction, and the rule was satisfied before any push.

The branch's own copy on the remote deliberately does not count. A branch that was pushed under its own name contains its own tip, so counting it would read every published agent branch — the one carrying the pull request — as holding nothing and delete the local copy after every agent.

Only branches The Framework itself minted are ever deleted this way: any `tf-` name, never the data branch. A leftover checkout can be sitting on a branch of the user's own, and deleting that is not The Framework's call even when it holds nothing. A clean checkout carrying a commit the remote has never seen takes the ordinary commit-push-keep path, which is exactly what that path exists to protect.

Only local remote-tracking references are read, never the remote itself; those are only ever behind it, so a tip they do not yet cover simply answers no and falls back to the push.

The question is asked before the agent's handoff level is consulted, so it settles the case for an agent set to publish nothing as well: its branch is deleted rather than pushed, and nothing is published either way. A cloud agent's hand-off anchor is consulted first of all, and answers the same case for it.

#### Rationale

Such a branch used to be pushed to satisfy the rule and then kept, which put empty agent branches on the remote and left the same names occupied locally. Git's own refusal to delete a branch that some checkout still has out must never be what keeps a branch safe: a leftover checkout was once found sitting on the user's `main`, and only that refusal stopped it being deleted.

### A birth branch the agent walked away from goes too

#### User story

The user's branch list does not collect one dead `tf-agent-<agent id>` branch per agent that ever ran.

#### Business logic

Every checkout is created on its birth branch, but the agent is instructed to create and check out its own `tf-<session name>` branch instead of being renamed onto it — so the rename never applies and the birth branch is left behind at the commit the agent started from, one per agent, forever.

The birth branch is therefore judged alongside the branch the checkout ended on: when that branch contains it, everything the birth branch holds is held again by a branch that either stays or has itself been proven to be inside the remote, so the birth branch goes with the checkout. A birth branch carrying a commit the kept branch lacks — the agent committed on it and then branched from somewhere else — stays. This is decided whether or not the branch the checkout was on goes too, and it is decided before anything is deleted, because the comparison has to read both branches.

### Delete is the one action that destroys history

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

Pruning walks the retained-worktrees list and reclaims every checkout whose agent is not still going, under the same rule as reclaiming one by hand. A checkout it leaves behind is reported with its reason — the agent is still running, its branch could not reach the remote, its handoff publishes nothing, its directory is not a git worktree — so removed plus skipped always adds up to what the list showed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
