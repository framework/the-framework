Reclaiming an agent's checkout: the one implementation behind every surface that removes one — a daemon's sweep and teardown, a dashboard's Remove button, an agent's own command line — so a second surface is never a second behaviour.

## User story

- The user reclaims disk space without ever wondering whether they just deleted the only copy of an agent's work.
- The user's uncommitted work, and an agent's, is never destroyed by cleanup.
- The user's remote and branch list do not collect one empty branch per agent that ever ran.

## Glossary

- **birth branch** - the `tf-agent-<agent id>` branch a checkout is created on, before the agent has named its session.
- **held by** - a commit the remote already has that provably contains everything a checkout could hold, such as the commit a cloud hand-off pushed.

## Business logic — TL;DR

- **Only what is on the remote may go** - a checkout is reclaimed only once everything it holds is on the remote: a clean tree, a pushed tip. Pushing is attempted as part of removal when the caller allows it.
- **Nothing is committed on the agent's behalf** - a dirty tree keeps its checkout, and says so, until a person commits or deletes it.
- **A caller that forbids the push gets removal only for what is already there** - when the branch may not be pushed, only a clean tree on a tip the remote already has goes.
- **A checkout held by a pushed commit goes without a push** - a clean tree whose tip is inside the stated commit provably holds nothing new, so it is removed with no push and keeps its branch.
- **A branch that holds nothing goes with the checkout** - a framework-minted branch whose tip the remote already has under another name is deleted along with the checkout instead of being pushed.
- **A birth branch the agent walked away from goes too** - when the branch the checkout ended on contains it.
- **A directory that is not a git worktree is left alone** - refused before a single git command runs in it.
- **Every refusal names its reason** - not a worktree, no branch, dirty, or not on the remote (with what git said, when a push failed), and the branch where known.

## Business logic

### Only what is on the remote may go

#### User story

See `## User story`.

#### Business logic

Once the directory is confirmed to be a git worktree root and its branch is known, the checkout comes off disk only once the remote has everything it holds. A dirty tree is kept. A clean tree whose tip is not on the remote is pushed, when the caller allows it, and kept with the reason when the push does not land — a repo with no remote never gets past this, which is the honest answer: there is nowhere for the work to be recoverable from. When the caller forbids the push, the checkout is kept unless its tip is already on the remote by someone's explicit act.

Once removal is decided, the caller gets to do its own cleanup first, then the checkout is removed and git's worktree bookkeeping is tidied. Any branch that goes with it is deleted last, after the checkout is off disk, because git refuses to delete a branch a checkout still has out. The outcome names which branches went, if any.

#### Rationale

This one rule replaced three interacting rules that each asked *how did this agent end*. The question that matters is *is this recoverable yet*. There is one failure mode, and it is legible: the push did not land, so the checkout stays and the reason says so.

### A checkout held by a pushed commit goes without a push

#### User story

The user's remote never fills up with empty branches, one per task they handed to a cloud session.

#### Business logic

When the caller names a commit the remote already has that holds everything the checkout could — a cloud hand-off's anchor — and the tree is clean with its tip inside that commit, the checkout is removed without any push and its branch stays. Anything short of that proof falls back to the ordinary rule.

### A branch that holds nothing goes with the checkout

#### User story

An agent that commits nothing on its own branch must leave neither a branch on the remote nor one on the user's machine.

#### Business logic

A checkout whose branch provably holds nothing the remote lacks is removed without any push, and that branch is deleted along with it. "Holds nothing" means the tree is clean and the branch tip is reachable from some remote-tracking branch *other than the branch's own copy* — a commit the remote already has under another name. The branch's own copy deliberately does not count: a branch pushed under its own name contains its own tip, so counting it would read every published agent branch as holding nothing.

The branch's own copy is the one under its name and the one it tracks: a branch renamed after it was pushed still tracks the remote copy under its old name, and that copy holding the tip proves nothing about another name having it, so such a branch is pushed under its new name rather than deleted. Only branches The Framework itself minted are ever deleted this way: any `tf-` name, never the data branch. A leftover checkout can be sitting on a branch of the user's own, and deleting that is not this package's call even when it holds nothing. Only local remote-tracking references are read, never the remote itself; a tip they do not yet cover simply answers no and falls back to the push.

### A birth branch the agent walked away from goes too

#### User story

The user's branch list does not collect one dead `tf-agent-<agent id>` branch per agent that ever ran.

#### Business logic

When the caller names the checkout's birth branch and the branch the checkout ended on contains it, the birth branch goes with the checkout: everything it holds is held again by a branch that either stays or has itself been proven to be inside the remote. A birth branch carrying a commit the kept branch lacks stays. This is decided before anything is deleted, because the comparison has to read both branches.

### A directory that is not a git worktree is left alone

#### User story

A checkout was removed by hand and something later recreated the directory. The user's own repository must not be pushed or have a branch deleted because of what is left under `.the-framework/branches/`.

#### Business logic

Before any git command is run in a checkout's directory, that directory is confirmed to be the root of a git checkout in its own right. A directory that is not one is refused as such and left exactly where it is.

#### Rationale

Git answers for any directory *inside* a repository, so a leftover directory makes every command run in it act on the enclosing repository instead — the user's own checkout, on the user's own branch.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
