Decides whether a finished agent's [1] checkout [2] may be removed, and removes it: the one implementation behind every surface that reclaims [3] a checkout (the daemon's sweep [4] and its teardown of an agent, the dashboard's "Remove" button, the `branches remove` and `branches prune` commands). One rule governs it: only what is on the remote may go, a clean tree whose tip the remote has, pushed here when the caller allows, so every deletion is recoverable and nothing local is ever the last copy of anything. Every refusal says why the checkout stays.

## Context

**User story**: the daemon reclaims [3] the checkouts [2] of finished agents [1] on its clock, so the disk holds nothing but live work; the user sees on the dashboard the checkouts still on disk, each with a "Remove" button, and a checkout with uncommitted work stays until the user commits or throws it away. Nothing the product removes on its own is ever lost: it is on the remote first.

**Problem**: the one question every keep-or-remove decision reduces to is "is this recoverable from the remote", never "how did the agent end". Git alone cannot answer it: it does not know whether the caller allows a push, whether a cloud session [5] already pushed the work under another commit, or which branch the checkout was born on. And a directory under `.branches/` that git no longer knows as a worktree makes every git command run in it act on the user's own checkout, so it must be recognized before anything runs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[3] reclaim: removing a finished agent's checkout once its work is on the remote.
[4] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[7] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[8] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.
[9] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.

## Business logic — TL;DR

- **Only what is on the remote may go** - a checkout is removed only once the remote has everything it holds: a clean tree and a pushed tip; nothing is committed on the agent's behalf, and a refusal names its reason.
- **What the caller knows and git does not** - whether the branch may be pushed at all, a pushed commit that already holds the checkout's work, the branch the checkout was born on, and a hook to run just before the checkout goes.
- **A directory git does not know as a worktree is left alone** - refusal `not-a-worktree`, decided before any git command runs in it.
- **A checkout on no branch is kept** - refusal `no-branch`.
- **Uncommitted work is kept** - refusal `dirty`, for any modified, staged or untracked file, and for a tree git cannot read; the check is made once, before every way out.
- **A tip inside a commit the caller vouches for goes without a push** - and keeps its branch.
- **An agent branch that holds nothing goes with its checkout** - its tip is on the remote under another name, so the branch is deleted, not pushed; the user's own branch never is.
- **Otherwise the branch must be on the remote** - pushed to `origin` here when the caller allows; refusal `not-on-remote` when it may not be pushed or the push did not land, with git's own words.
- **The birth branch goes when the branch that stays contains it** - an agent that branched away leaves `agent-<agent id>` behind, and it goes once judged, before anything is deleted.
- **How the removal runs and what it reports** - hook, worktree, stale records, then the branches; success lists the branches that went, and only a git failure past the decision is raised.

## Business logic

### Only what is on the remote may go

#### Context

See `## Context`.

#### Business logic

A checkout [2] is removed only once the remote has everything it holds: a clean tree, and a tip the remote has, whether it was there already or was pushed on the way. Every deletion is therefore recoverable from the remote. Nothing is committed on the agent's [1] behalf: a checkout holding uncommitted work is kept until a person commits or deletes it, and nothing of it is pushed. There is one way for the rule to fail, and it is legible: the branch's tip is not on the remote and could not or may not be pushed, so the checkout stays and the refusal says so. Whether the agent still runs is never asked here; the caller decides when to reclaim [3], and the dashboard's "Remove" button, the daemon's sweep [4] and the `branches` command line all go through this one decision.

### What the caller knows and git does not

#### Context

**Business logic story**: the daemon knows the agent's [1] handoff [6] and, for a `web` agent, the commit its cloud session [5] pushed; it also knows the branch the checkout [2] was created on and what serves the tree while the agent runs. None of that is readable from git, so it comes in as the caller's word. The command line passes only whether a push is allowed (`--no-push` in `cli.ts`).

#### Business logic

Four things come from the caller:

- Whether the branch may be pushed to satisfy the rule. When not, only a clean tree on a tip the remote already has goes: removing what the remote holds publishes nothing. An agent whose handoff [6] is `local` keeps its work in its checkout [2], and its caller allows no push.
- A commit the remote already has that provably holds everything the checkout could hold, such as the commit a cloud session [5] pushed on the agent's behalf. Anything short of that proof falls back to the ordinary rules.
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

**User story**: the work of a `web` agent [1] leaves this machine; its cloud session [5] pushes the result under a commit of its own, and the checkout [2] left behind holds nothing beyond what that commit already has on the remote.

#### Business logic

When the caller names a commit the remote already has, and the checkout's [2] tip is that commit or an ancestor of it, the remote has the work: the checkout goes without a push and keeps its branch, even a branch the next rule would delete. When the tip is not inside that commit, or the commit cannot be resolved, the ordinary rules below apply.

### An agent branch that holds nothing goes with its checkout

#### Context

**Problem**: an agent [1] that committed nothing, or whose commits already reached the remote under another branch's name, leaves a branch whose every commit `origin` already has. Pushing it would publish an empty branch; keeping it would strand the checkout [2] behind a push that has nothing to push. Git's own "merged" test asks the wrong question, and its refusal to delete a checked-out branch must never be the guard.

#### Business logic

A branch holds nothing of its own when its tip is reachable from a remote-tracking branch under another name, on any remote: the remote already has that commit under that other name, so nothing on the branch is unique to it. The branch's own copies do not count: the remote-tracking branch under its own name on any remote, and the branch it tracks as upstream (a branch renamed after it was pushed still tracks the remote copy under its old name, and that copy holding the tip proves nothing about another name having it). A pushed branch with a pull request contains its own tip and is exactly the branch that must stay. Only an agent branch [9] qualifies: a leftover checkout [2] can sit on the user's own branch, and deleting that is never this package's call, even when it holds nothing. Such a branch goes with its checkout, unpushed, deleted after the checkout is removed. The read takes the local remote-tracking refs, never a fetch, so it is at most behind the remote: a tip they do not cover yet reads as holding something, and the next rule applies.

### Otherwise the branch must be on the remote

#### Context

See `## Context`.

#### Business logic

A branch is on the remote when its tip is the tip of `origin/<branch>` or an ancestor of it, read from the local remote-tracking refs (`worktree.ts`). When it is not:

- If the caller allows no push, the checkout [2] stays, with the refusal `not-on-remote` naming the branch.
- Otherwise the branch is pushed to `origin` here, the user's own branch included when the checkout ended on one, since the push is what makes the removal recoverable. A push that does not land is the refusal `not-on-remote`, naming the branch and carrying git's own words as `detail`; the checkout stays. A repository with no remote never gets past this, which is the honest answer: there is nowhere for the work to be recoverable from.

A branch that is on the remote, or pushed here, stays: it may be the branch a pull request is open on.

### The birth branch goes when the branch that stays contains it

#### Context

**Problem**: an agent [1] that switched to another branch during its work leaves its birth branch [7] `agent-<agent id>` behind, a name that holds nothing the branch it ended on lacks.

#### Business logic

When the caller names the birth branch [7] and it differs from the branch the checkout [2] ended on, it goes with the checkout when it is an agent branch [9] and everything on it is on the branch that stays: it exists, and its tip is that branch's tip or an ancestor of it. The same guard that protects the checkout's own branch protects this one: a birth branch that is not an agent branch is never deleted. The judgment is made before anything is deleted, since it reads both branches.

### How the removal runs and what it reports

#### Context

See `## Context`.

#### Business logic

Once removal is decided, in this order: the caller's hook runs, to stop whatever serves the tree; the worktree is removed, and git's records of worktrees whose directories are gone are pruned (both in `worktree.ts`); then the branches are deleted, the checkout's [2] own when it held nothing, and the birth branch [7] when it goes, only now, because git refuses to delete a branch a worktree still has checked out. Success reports the branches that went, in that order, or no list at all when none went. Every refusal is an outcome handed back, not an error; only a git failure past the decision, in the removal itself, is raised to the caller.
