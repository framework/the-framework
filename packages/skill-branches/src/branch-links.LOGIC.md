Keeps `.branches/` readable by current branch name: beside each checkout [1] whose branch no longer matches its directory's name, a branch link [2] named as the branch and pointing at the directory, added when it is missing and dropped when it goes stale, without ever touching anything that is not the package's own link.

## Context

**User story**: an agent [3] names its work early: its session name [4] renames its branch to `agent-<session name>` while its checkout's directory stays `agent-<agent id>`, named by its agent id [5]. The user who types `cd .branches/agent-<session name>` reaches that agent's checkout, and the listing of `.branches/` reads as the branches that exist now.

**Problem**: renaming a checkout's directory under a running agent is not an option, so a rename costs a link instead. Links go stale as branches are renamed again and checkouts are reclaimed, and `.branches/` may hold the user's own files or links too, which must not be touched.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[2] branch link: a symbolic link under `.branches/`, named as the branch a checkout is on now and pointing at that checkout's directory, so `.branches/<branch>` reaches the checkout by its current branch name.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[6] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.
[7] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.
[8] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[9] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.

## Business logic — TL;DR

- **The links wanted** - one per checkout whose current branch differs from its directory's name, named as the branch, pointing at the directory by its relative name; a detached checkout, a slashed branch and a directory git does not know as a worktree get none.
- **Stale links dropped** - a link whose target is an agent branch [6] name is the package's, whatever the link's own name, and goes when it is no longer wanted with exactly that target.
- **Nothing else is touched** - a file, a directory or a link to anywhere else at a link's path is left alone, and no link is made over it.
- **When it runs** - after a checkout is made, named or removed, and on the daemon's clock; it never fails its caller.

## Business logic

### The links wanted

#### Context

See `## Context`.

#### Business logic

Every checkout [1] directory on disk (the listing rule in `worktree.ts`) is read for the branch it is on, with the read that answers only for a worktree root [7]: a directory under `.branches/` that git does not know as a worktree has no branch here, since a plain read would answer with the user's own branch and produce a link named `main`. A checkout whose head is detached has no name to link; a branch with a `/` in it cannot be a name under `.branches/`; a directory already named as its branch (a checkout still on its birth branch [8]) needs no link. Every other checkout wants one link: named as its branch, pointing at the checkout directory's name, relative, so the link is a sibling that survives the project's directory moving.

### Stale links dropped

#### Context

See `## Context`.

#### Business logic

Every entry of `.branches/` that is a symbolic link whose target is an agent branch [6] name (`agent-…`, `agent-data` aside) is the package's to remove, whatever the link's own name and whether or not the target still exists. Such a link is removed when no checkout [1] wants a link of that name, or when the wanted link of that name points at a different directory: a branch name reused by a newer checkout gets a new link, and the old one goes first. A link that is wanted with exactly its target stays.

### Nothing else is touched

#### Context

See `## Context`.

#### Business logic

An entry that is not a symbolic link (the user's own file or directory), or a link pointing anywhere but an agent branch [6] name, is never removed. When something already sits at a wanted link's path, no link is made over it: the user's file wins and the checkout [1] simply has no link by that name. `.branches/` is created if missing before a link is made; a missing `.branches/` reads as empty.

### When it runs

#### Context

**Business logic story**: the command line reconciles the links right after `create`, `attach`, `name`, `remove` and `prune` (`cli.ts`), the checkout sequence does so after every checkout it makes (`checkout.ts`), and the daemon runs the same pass as a sweep [9] on its clock, per project.

#### Business logic

The pass derives the wanted links from what is on disk each time, so a rename is covered by the same rule as a creation: the old name stops being wanted and is dropped, the new one is created. Nothing in the pass raises an error to the caller: a link that cannot be made or removed is skipped.
