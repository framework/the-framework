Decides whether a finished agent's [1] checkout [2] may be removed, and removes it: the one implementation behind every surface that reclaims [3] a checkout (`agent-runner` at a run's end and in its sweep [4], the dashboard's "Remove" button, the `branches remove` and `branches prune` commands). One rule governs it: only what is on the remote may go, a clean tree whose tip the remote has, an agent branch [10] pushed here when the caller allows, so every deletion is recoverable and nothing local is ever the last copy of anything. Every refusal says why the checkout stays. Beside it, one way out for a person: discarding a checkout whatever it holds.

## Context

**User story**: the runner (`agent-runner`) reclaims [3] the checkout [2] of each finished agent [1] it ran when the run ends, and its sweep [4] reclaims those whose process died, so the disk holds nothing but live work; the user sees on the dashboard the checkouts still on disk, each with a "Remove" button, and a checkout with uncommitted work stays until the user commits or throws it away. Nothing the product removes on its own is ever lost: it is on the remote first.

**Problem**: the one question every keep-or-remove decision reduces to is "is this recoverable from the remote", never "how did the agent end". Git alone cannot answer it: it does not know whether the caller allows a push, whether a pushed commit already covers everything the checkout holds, or which branch the checkout was born on. And a directory under `.branches/` that git no longer knows as a worktree makes every git command run in it act on the user's own checkout, so it must be recognized before anything runs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[3] reclaim: removing a finished agent's checkout once its work is on the remote.
[4] sweep: `agent-runner`'s pass, run by the scheduler on every tick, that records and reclaims the runs of this machine whose process died, and only this machine's.
[6] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it.
[7] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[8] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.
[9] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[10] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.

## Business logic — TL;DR

- **Only what is on the remote may go** - a checkout is removed only once the remote has everything it holds: a clean tree and a pushed tip; nothing is committed on the agent's behalf, and a refusal names its reason.
- **What the caller knows and git does not** - whether the branch may be pushed at all, the commit the branch started from, a pushed commit that already holds the checkout's work, the branch the checkout was born on, and a hook to run just before the checkout goes.
- **A directory git does not know as a worktree is left alone** - refusal `not-a-worktree`, decided before any git command runs in it.
- **A checkout on no branch is kept** - refusal `no-branch`.
- **Uncommitted work is kept** - refusal `dirty`, for any modified, staged or untracked file, and for a tree git cannot read; the check is made once, before every way out.
- **A tip inside a commit the caller vouches for goes without a push** - and keeps its branch.
- **A branch that holds nothing goes without a push** - it has no commit past where it started (the commit the caller names, else `origin`'s default branch), so the checkout goes; an agent branch is deleted with it, the user's own branch stays.
- **Otherwise the branch must be on the remote** - an agent branch is pushed to `origin` here when the caller allows, the user's own branch never; refusal `not-on-remote` when it may not be pushed or the push did not land, with git's own words.
- **The birth branch goes when the branch that stays contains it** - an agent that branched away leaves `agent-<agent id>` behind, and it goes once judged, before anything is deleted.
- **How the removal runs and what it reports** - hook, worktree, stale records, then the branches; success lists the branches that went, and only a git failure past the decision is raised.
- **Discarding a checkout** - a person's call: the checkout goes whatever it holds, nothing pushed, no branch deleted; only a directory git does not know as a worktree is left alone.

## Business logic

### Only what is on the remote may go

#### Context

See `## Context`.

#### Business logic

A checkout [2] is removed only once the remote has everything it holds: a clean tree, and a tip the remote has, whether it was there already or was pushed on the way. Every deletion is therefore recoverable from the remote. Nothing is committed on the agent's [1] behalf: a checkout holding uncommitted work is kept until a person commits or deletes it, and nothing of it is pushed. There is one way for the rule to fail, and it is legible: the branch's tip is not on the remote and could not or may not be pushed, so the checkout stays and the refusal says so. Whether the agent still runs is never asked here; the caller decides when to reclaim [3], and the runner, the dashboard's "Remove" button and the `branches` command line all go through this one decision.

### What the caller knows and git does not

#### Context

**Business logic story**: the caller knows whether a push is allowed, the branch the checkout [2] was created on, what serves the tree while the agent [1] runs, and, for a `web` agent, its cloud anchor [6]. None of that is readable from git, so it comes in as the caller's word. The runner and the dashboard's "Remove" button allow the push, name the birth branch [7], and name the commit the branch started from when the agent's record has one (an agent started from another branch); no caller names a cloud anchor. The command line passes whether a push is allowed (`--no-push` in `cli.ts`), the commit the branch started from (`--from`), and the birth branch its directory names.

#### Business logic

Five things come from the caller:

- Whether the branch may be pushed to satisfy the rule. When not, only a clean tree on a tip the remote already has goes: removing what the remote holds publishes nothing. `branches remove --no-push` is such a caller.
- The commit the checkout's branch started from, when that is not `origin`'s default branch: a branch started from another branch. It is what tells such a branch with nothing of its own from one that holds its own work (see "A branch that holds nothing goes without a push").
- A commit the remote already has that provably holds everything the checkout could hold. For a `web` agent that is its cloud anchor [6], the empty commit pushed before the task left this machine: a checkout still at that commit, or before it, holds nothing the remote lacks. Anything short of that proof falls back to the ordinary rules.
- The birth branch [7], when it may differ from the branch the checkout ended on.
- A hook to run once removal is decided and just before the checkout goes, to stop whatever serves the tree. The command line passes none.

Nothing here reads configuration.

### A directory git does not know as a worktree is left alone

#### Context

See `## Context`.

#### Business logic

Before any git command runs in the directory, the directory must be a worktree root [8]: the top level of a worktree git knows (the read is in `worktree.ts`). A directory under `.branches/` that git does not know, a checkout [2] removed by hand or leftovers after a removal, would make every command below act on the enclosing repository: the user's own checkout, the user's own branch. Nothing is pushed or deleted through such a directory; it is left where it is, with the refusal `not-a-worktree`.

### A checkout on no branch is kept

#### Context

See `## Context`.

#### Business logic

A checkout [2] whose head is detached has no branch to push or to judge, so it is kept, with the refusal `no-branch`.

### Uncommitted work is kept

#### Context

**Problem**: the removal that follows the decision forces past a tree git calls unclean (`worktree.ts`), so the clean check here is the only guard between an agent's [1] uncommitted work and its deletion.

#### Business logic

The tree must be clean: no modified, staged or deleted tracked file and no untracked file (the read is in `worktree.ts`); ignored files do not count. A checkout [2] holding uncommitted work is kept, with the refusal `dirty` naming the branch it is on, until a person commits or deletes the work. A status git cannot read counts as dirty. The check is made once, before every way out below, since each of them ends in the same removal.

### A tip inside a commit the caller vouches for goes without a push

#### Context

**User story**: a `web` agent's [1] work leaves this machine for a cloud session [9] once the agent has pushed its cloud anchor [6]; the checkout [2] left behind sits at that anchor, or before it, and holds nothing the remote lacks, so it must go without anyone pushing on its behalf.

#### Business logic

When the caller names a commit the remote already has, and the checkout's [2] tip is that commit or an ancestor of it, the remote has the work: the checkout goes without a push and keeps its branch, even a branch the next rule would delete. When the tip is not inside that commit, or the commit cannot be resolved, the ordinary rules below apply.

### A branch that holds nothing goes without a push

#### Context

**Problem**: an agent [1] that committed nothing, or whose commits are already on `origin`'s default branch, leaves a branch that holds nothing of its own. Pushing it would publish an empty branch; keeping it would strand the checkout [2] behind a push that has nothing to push. The same holds for a leftover checkout on the user's own branch whose tip `origin`'s default branch already has. Git's own "merged" test asks the wrong question, and its refusal to delete a checked-out branch must never be the guard.

**Problem**: "the tip is on the remote under another name" does not say a branch is empty. An agent started from another agent's branch (a subagent, started from its main agent's branch) carries that agent's commits, so once its branch is pushed the remote holds the first agent's tip under the second one's name. The first agent's branch still holds that agent's own work, and is the only branch the work is its own on.

#### Business logic

A branch holds nothing of its own when it has no commit past where it started. Where it started is one of two things:

- When the caller names no commit: `origin`'s default branch (what `origin`'s HEAD points at, else `origin/main`, else `origin/master`), where every agent branch starts unless told otherwise. The branch holds nothing when its tip is that branch's tip or an ancestor of it. A repository with no such branch has no branch that holds nothing.
- When the caller names the commit the branch started from: the branch holds nothing when its tip is that commit or an ancestor of it, and a remote-tracking branch under another name, on any remote, holds that commit, so the commit is on the remote whatever happens to this branch. A commit this machine does not have proves nothing: the branch reads as holding something. So does a branch started from another branch whose start the caller does not name: measured from the default branch, what it started on reads as its own.

A branch with a commit past where it started holds its own work, whatever other name on the remote holds its tip.

The branch's own copies do not count as another name: every remote-tracking branch whose name ends in `/<branch>` on any remote (so `origin/feat/<branch>` is dropped too, on the safe side), and likewise every one whose name ends in `/<birth branch>` (a branch renamed after it was pushed left its remote copy under its birth name, and that copy holding a commit proves nothing about another name having it).

The checkout of a branch that holds nothing goes, and nothing is pushed. Its branch goes with it, deleted after the checkout is removed, only when it is an agent branch [10]: a leftover checkout [2] can sit on the user's own branch, and deleting that is never this package's call, even when it holds nothing; that branch stays. The read takes the local remote-tracking refs, never a fetch, so it is at most behind the remote: a commit they do not cover yet reads as holding something, and the next rule applies.

### Otherwise the branch must be on the remote

#### Context

See `## Context`.

#### Business logic

A branch is on the remote when its tip is the tip of `origin/<branch>` or an ancestor of it, read from the local remote-tracking refs (`worktree.ts`). When it is not:

- If the caller allows no push, or the branch is not an agent branch [10], the checkout [2] stays, with the refusal `not-on-remote` naming the branch. A checkout continued on the user's own branch, `main` included, is never pushed for the user: publishing that branch is the user's call, never a cleanup's.
- Otherwise the agent branch is pushed to `origin` here, since the push is what makes the removal recoverable. A push that does not land is the refusal `not-on-remote`, naming the branch and carrying git's own words as `detail`; the checkout stays. A repository with no remote never gets past this, which is the honest answer: there is nowhere for the work to be recoverable from.

A branch that is on the remote, or pushed here, stays: it may be the branch a pull request is open on.

### The birth branch goes when the branch that stays contains it

#### Context

**Problem**: an agent [1] that switched to another branch during its work leaves its birth branch [7] `agent-<agent id>` behind, a name that holds nothing the branch it ended on lacks.

#### Business logic

When the caller names the birth branch [7] and it differs from the branch the checkout [2] ended on, it goes with the checkout when it is an agent branch [10] and everything on it is on the branch that stays: it exists, and its tip is that branch's tip or an ancestor of it. The same guard that protects the checkout's own branch protects this one: a birth branch that is not an agent branch is never deleted. The judgment is made before anything is deleted, since it reads both branches.

### How the removal runs and what it reports

#### Context

See `## Context`.

#### Business logic

Once removal is decided, in this order: the caller's hook runs, to stop whatever serves the tree; the worktree is removed, and git's records of worktrees whose directories are gone are pruned (both in `worktree.ts`); then the branches are deleted, the checkout's [2] own when it held nothing, and the birth branch [7] when it goes, only now, because git refuses to delete a branch a worktree still has checked out. Success reports the branches that went, in that order, or no list at all when none went. Every refusal is an outcome handed back, not an error; only a git failure past the decision, in the removal itself, is raised to the caller.

### Discarding a checkout

#### Context

**User story**: the user deletes a run from the dashboard, or runs `branches remove --discard`, for a run they are throwing away: its checkout [2] holds uncommitted work the rule above keeps, and the user has decided it is not worth keeping.

#### Business logic

A person may discard a checkout [2]: it goes whatever it holds, uncommitted work included, and nothing is pushed. The branch and its commits stay: deleting a branch that may carry an open pull request is git's business, never this tool's on the way out of a checkout. One guard applies, the same as above: a directory git does not know as a worktree root [8] is left alone, `not-a-worktree`, decided before anything runs in it. Then the caller's hook runs, the worktree is removed by force, and git's records of gone worktrees are pruned.
