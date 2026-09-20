Reads what a branch holds and where it stands: the commits and files it carries beyond the project's default branch, whether the remote has its tip, whether the default branch already contains it, and what the checkout [1] on it left uncommitted. Git facts only, read from the project's repository, so the answer is the same whether or not the agent's [2] checkout still exists; the branch's pull request is the caller's own question and is never asked here. What `branches show` prints, for the dashboard's server, which reads a finished agent's work through the command.

## Context

**User story**: a run has ended, and the user looks at its page: how many commits, which files, whether the work is pushed or already landed, whether something was left uncommitted, and, from that, whether there is a pull request to open or a merge to land. The "needs you" list names the finished runs whose branch was never pushed.

**Problem**: a finished agent's checkout is usually gone (reclaimed once its work reached the remote), so a read addressed to the checkout would fall back to the user's own working copy and report the user's branch as the agent's. The branch is what outlives the agent, so the branch is the subject.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] base: the branch a branch is measured against: the remote's default branch (`origin/HEAD`), else a local `main` or `master`.

## Business logic — TL;DR

- **One read for several branches** - the branches asked for answer in the order asked; the remote, the base [3] and the checkouts on disk are read once for all of them.
- **A branch that is gone** - answers `exists: false`, empty commit and file lists, nothing pushed, nothing merged; the checkout's uncommitted paths still answer when a checkout is on it.
- **What the branch holds** - its own commits beyond the base [3], newest first, and the files changed since it left the base with their line counts, a binary file flagged; without a base, both lists are empty.
- **Where it stands** - `hasRemote` when the repository has a remote; `pushed` when `origin` has the branch at exactly this tip; `merged` when the base already contains the branch.
- **What the checkout left uncommitted** - the paths a `git status` of the checkout on the branch reports (a rename by its new path, a quoted path unquoted); absent when no checkout under `.branches/` is on the branch, so "nobody asked" and "asked, clean" read differently.
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

### Where it stands

#### Context

See `## Context`.

#### Business logic

`hasRemote` is whether the repository has any remote configured (`worktree.ts`). `pushed` is whether the remote-tracking branch `origin/<branch>` points at the very commit the local branch does, read from the local refs, never a fetch. `merged` is whether git lists the branch as merged into the base [3]. A gone branch is neither pushed nor merged.

### What the checkout left uncommitted

#### Context

**Problem**: work an agent [2] never committed is not on the branch, so no commit and no file lists it; yet it is exactly what a person must know before deciding the run left nothing.

#### Business logic

When a checkout [1] under `.branches/` is on the branch, the state carries `pendingFiles`: every path `git status` reports there, modified, staged, deleted or untracked, a rename by its new path, a quoted path unquoted; an empty list when the tree is clean. When no checkout is on the branch, the field is absent. A status git cannot read leaves the field absent too.
