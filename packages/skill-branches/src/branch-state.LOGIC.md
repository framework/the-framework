Reads what a branch holds and where it stands: the commits and files it carries beyond the project's default branch, whether the remote has its tip, whether the default branch already contains it, and what the checkout [1] on it left uncommitted. Git facts only, read from the project's repository, so the answer is the same whether or not the agent's [2] checkout still exists; the branch's pull request is the caller's own question and is never asked here. A caller that knows the commit a branch started from names it, and the commits and files are then measured from that commit instead of the default branch. A full commit id asked in place of a branch is read as a branch that ends at that commit. What `branches show` prints, for the dashboard's server, which reads a finished agent's work through the command.

## Context

**User story**: a run has ended, and the user looks at its page: how many commits, which files, whether the work is pushed or already landed, whether something was left uncommitted, and, from that, whether there is a pull request to open or a merge to land. The "needs you" list names the finished runs whose branch was never pushed.

**Problem**: a finished agent's checkout is usually gone (reclaimed once its work was committed), so a read addressed to the checkout would fall back to the user's own working copy and report the user's branch as the agent's. The branch is what outlives the agent, so the branch is the subject.

**Problem**: a branch started from another branch (a subagent's branch starts from its main agent's) holds, beyond the default branch, that other branch's work as well as its own. Measured from the default branch, the other branch's commits and files would read as this branch's.

**Problem**: a subagent's branch is deleted once its main agent landed its work, and its last commit is kept. What the branch held must still be readable, by that commit.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] base: what a branch is measured against: the commit the caller names as the one the branch started from, when this machine has it; else the default branch, which is the remote's default branch (`origin/HEAD`), else a local `main` or `master`.

## Business logic — TL;DR

- **One read for several branches** - the branches asked for answer in the order asked; the remote, the base [3] and the checkouts on disk are read once for all of them.
- **A branch that is gone** - answers `exists: false`, empty commit and file lists, nothing pushed, nothing merged; the checkout's uncommitted paths still answer when a checkout is on it.
- **What the branch holds** - its own commits beyond the base [3], newest first, and the files changed since it left the base with their line counts, a binary file flagged; without a base, both lists are empty.
- **Measured from the commit the branch started at** - a caller that names the commit the branches started from gets their commits and files beyond that commit; a commit this machine does not have is no base [3], and the default branch is.
- **A commit in place of a branch** - a full 40-character commit id asked in place of a branch name is read as a branch whose tip it is: what a branch held, once the branch is gone and its last commit was kept.
- **Where it stands** - `hasRemote` when the repository has a remote; `pushed` when `origin` has the branch at exactly this tip; `merged` when the default branch already contains the branch, whatever commit the caller named.
- **The name the agent gave its work** - `name`: the branch minus this package's `agent-` prefix; absent for a branch the package did not mint, and for a checkout still on the branch it was created on (`agent-<agent id>`); a branch no checkout is on is named by its suffix, since nothing tells its birth name apart. The reader draws this where it labels a branch, and never cuts the prefix itself.
- **What the checkout left uncommitted** - the paths a `git status` of the checkout on the branch reports (a rename by its new path, a quoted path read without its surrounding quotes (git's escapes inside stay as they are)); absent when no checkout under `.branches/` is on the branch, so "nobody asked" and "asked, clean" read differently.
- **Forgiving** - a git read that fails reads as empty, never as an error.

## Business logic

### One read for several branches

#### Context

See `## Context`.

#### Business logic

Given the project and a list of branch names, the read answers one state per name, in the order given. Whether the repository has a remote, which branch is the base [3], and which checkout [1] under `.branches/` sits on which branch are read once and shared by every branch asked for.

### What the branch holds

#### Context

See `## Context`.

#### Business logic

The branch exists when the repository has a local branch of that name. Its own commits are those the base [3] does not have (`base..branch`), newest first, each with its full hash and its subject; its files are the change since the branch left the base (`base...branch`), each path with lines added and removed, or flagged binary with zero counts when git reports no line counts. A repository with no base answers empty lists and no base.

### Measured from the commit the branch started at

#### Context

See the second problem in `## Context`.

#### Business logic

The caller may name one commit, the commit the branches asked for started from. When this machine has that commit, it is the base [3] of every branch in the read: the commits are those made after it, the files are the change since the branch left it, and the state's `base` is that commit's id. When this machine does not have the commit, it is ignored and the default branch is the base, as with no commit named. Whether the branch is merged is never measured from the named commit (see "Where it stands").

### A commit in place of a branch

#### Context

See the third problem in `## Context`.

#### Business logic

A name that is not a local branch and is a full commit id (40 lowercase hexadecimal characters) that this machine has is read as a branch whose tip is that commit: it answers `exists: true`, with the commit id as `branch`, and its commits and files beyond the base [3]. It is never pushed and never merged, it has no name and no uncommitted paths, since no branch and no checkout [1] carry a commit id as their name. A shorter commit id, or any other name that is not a local branch, is a branch that is gone.

### Where it stands

#### Context

See `## Context`.

#### Business logic

`hasRemote` is whether the repository has any remote configured (`worktree.ts`). `pushed` is whether the remote-tracking branch `origin/<branch>` points at the very commit the local branch does, read from the local refs, never a fetch. `merged` is whether git lists the branch as merged into the default branch. It is always the default branch's answer, even when the caller named the commit the branch started from: a branch that holds nothing beyond that commit is not merged for that. A gone branch is neither pushed nor merged.

### What the checkout left uncommitted

#### Context

**Problem**: work an agent [2] never committed is not on the branch, so no commit and no file lists it; yet it is exactly what a person must know before deciding the run left nothing.

#### Business logic

When a checkout [1] under `.branches/` is on the branch, the state carries `pendingFiles`: every path `git status` reports there, modified, staged, deleted or untracked, a rename by its new path, a quoted path read without its surrounding quotes (git's escapes inside stay as they are); an empty list when the tree is clean. When no checkout is on the branch, the field is absent. A status git cannot read leaves the field absent too.
