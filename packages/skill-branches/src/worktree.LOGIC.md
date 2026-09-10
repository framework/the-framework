Runs git's worktree mechanism for agents [1]: where an agent's checkout [2] lives, creating one on a fresh branch or on an existing branch, telling a real checkout from a directory git no longer knows, renaming the branch to the session name [3] the agent picks, removing and pruning, and the reads every keep-or-remove decision needs: whether a checkout is clean, whether its branch is on the remote, how big it is. The decision itself is not made here; `reclaim.ts` makes it from these reads.

## Context

**User story**: several agents work one project at the same time, each in its own checkout under `.branches/`, and the user's own working copy is never an agent's. The dashboard lists the checkouts left on disk with their size and a Remove button; an agent names its work and the dashboard labels it by that session name [3].

**Problem**: git answers for any directory inside a repository. A directory under `.branches/` that git no longer knows as a worktree (a checkout removed by hand, a marker file written after a removal) makes every git command run in it act on the enclosing repository: the user's own checkout, on the user's own branch. Several rules below exist to keep such a directory from being read, renamed, pushed or judged as if it were an agent's checkout.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[3] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[4] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[5] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[6] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.
[7] branch link: a symbolic link under `.branches/`, named as the branch a checkout is on now and pointing at that checkout's directory, so `.branches/<branch>` reaches the checkout by its current branch name.
[8] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[9] reclaim: removing a finished agent's checkout once its work is on the remote.
[10] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.

## Business logic — TL;DR

- **Where a checkout lives** - `<project>/.branches/agent-<agent id>`, the directory named as the agent id [4] and as the birth branch [5].
- **Which directories are checkouts** - a directory under `.branches/` named as an agent branch [6] with a valid id; links and files are not, and neither is `agent-data`.
- **Creating a checkout on a fresh branch** - a new worktree on a new branch from the project's head or a named base, refused for an unsafe id before git runs, and a git failure surfaces.
- **Continuing an agent on an existing branch** - the worktree is checked out on the branch given; a branch gone locally comes back from the remote's copy, and one gone everywhere is recreated from the project's head.
- **Telling a checkout from a directory git does not know** - a directory counts as a checkout only when git's top level is that very directory; a plain branch read in any other directory under `.branches/` would answer with the user's branch.
- **The project a directory belongs to** - two levels up from a checkout under `.branches/`, else the checkout itself, read from the layout rather than from git's notion of the main repository.
- **Naming the work** - the branch is renamed to `agent-<name>`, a taken name gets `-2`, `-3`, and so on, and only an agent branch is ever renamed.
- **Removing a checkout and what it leaves** - a plain removal, forced only when git calls unclean a checkout the package found clean, and said so; a branch that held nothing is force-deleted; stale worktree records are pruned.
- **What the remote has** - a branch is on the remote when `origin` has its tip or a descendant of it, read from local remote-tracking refs, and a repository with no remote keeps everything.
- **When a checkout is clean** - nothing uncommitted and nothing untracked; a status git cannot read is never taken as clean.
- **The worktrees git knows** - every worktree registered with git, with its path, its commit and its branch when not detached.
- **A checkout's size on disk** - measured on request, and unknown rather than wrong whenever it cannot be read.

## Business logic

### Where a checkout lives

#### Context

See `## Context`.

#### Business logic

An agent's checkout [2] is the directory `.branches/agent-<agent id>` inside the project's checkout. The directory is named as the agent id [4], which is also the birth branch [5], and keeps that name for the checkout's whole life, even after the branch is renamed: the current branch name is then reachable as a branch link [7] beside it (`branch-links.ts`). `.branches/` also holds the `agent-data` branch's [8] checkout, at `.branches/agent-data`, made by the daemon and never by this package.

### Which directories are checkouts

#### Context

**Problem**: `.branches/` holds more than checkouts: the branch links [7] (symbolic links named as branches, pointing at checkouts), the `agent-data` branch's [8] checkout, and whatever else lands there.

#### Business logic

A checkout on disk is a directory, not a symbolic link and not a file, directly under `.branches/`, whose name is an agent branch [6] and whose part after `agent-` is a valid agent id [4]. Each yields the agent id and the directory's path. `agent-data` is excluded because `data` is not a valid agent id, and so is every dot-entry. A missing or unreadable `.branches/` yields no checkouts and no error, as for a project that never ran an agent [1]. The set of agent ids that have a checkout directory is derived from the same listing.

### Creating a checkout on a fresh branch

#### Context

**User story**: the user starts an agent; it gets its own checkout on a branch of its own, branched from the commit the project's checkout is on unless the caller names another base (the `--base` option of `create`).

#### Business logic

The agent id [4] is checked before anything runs: an id outside its charset is rejected, so no caller can create a directory outside `.branches/`. Git then creates the worktree at the checkout's [2] path on a new branch named by the caller (the birth branch [5] `agent-<agent id>` for every checkout the package creates), starting from the base named or, with none, from the commit the project's checkout is on. Git makes the directory and any missing parent, `.branches/` included. Any git failure surfaces to the caller instead of being swallowed, since an agent [1] that wants to start needs its checkout: a branch or directory that already exists, or a base that does not resolve, is reported as git's own failure.

### Continuing an agent on an existing branch

#### Context

**User story**: the user continues an agent whose checkout was reclaimed [9]; the agent must find itself on the branch its work is on, with its previous commits, rather than on a fresh branch from the project's head that strands what it did last time.

#### Business logic

The agent id [4] is checked as above. Git then checks the branch named by the caller out into the checkout's [2] path; the branch is taken as given, a `/` in it included. A branch that is gone locally but present on the remote as `origin/<branch>` is recreated from that copy by git itself. When git refuses and the branch exists locally, the refusal surfaces, as for a branch the user's own checkout has out. When git refuses and the branch does not exist locally, the branch is created from the commit the project's checkout is on and checked out there. That fallback is sound because the only branches the package ever deletes held nothing that was not already on the remote or on the branch that stayed, so the project's head is where the agent's work was.

### Telling a checkout from a directory git does not know

#### Context

See `## Context`.

#### Business logic

A directory is a worktree root [10] when git, asked from inside it, reports that very directory as the top level of the working tree, both paths compared after resolving symbolic links. The project's checkout and an agent's checkout [2] are worktree roots; a subdirectory of either is not, a directory left under `.branches/` that git does not know is not, and a directory outside any repository is not. Any failure to ask reads as "not a worktree root". Two branch reads exist: the plain one answers the branch checked out at a path, and nothing when the head is detached or the path is not in a repository; the guarded one answers the branch only for a worktree root and nothing otherwise. Every consumer of a `.branches/` directory (the listing, naming, `status`, the branch links [7], reclaiming [9]) uses the guarded read or the root check first, so a directory git does not know is never read as being on the user's branch.

### The project a directory belongs to

#### Context

**User story**: an agent [1] runs `npx branches` from inside its checkout, or the user runs it from the project's checkout, and either way the command acts on the project: the checkout whose `.branches/` holds the agents' checkouts.

#### Business logic

From any directory, the root of the checkout [2] containing it is found through git. When that root's parent directory is named `.branches`, the project is the parent's parent; otherwise the project is that root itself. The answer comes from the directory layout rather than from git's notion of the main repository, so a project that is itself a linked worktree of another repository, or a submodule, answers with the directory the user registered rather than with the main repository. Outside a repository there is no project, and the read fails.

### Naming the work

#### Context

**User story**: before its first change the agent names its work (`npx branches name <name>`); the dashboard then labels it by that session name [3], and `.branches/<agent-name>` reaches its checkout. The agent asked for a name and reads back the one it got.

**Problem**: two agents may ask for the same name, at the same moment even; a branch of that name may already exist locally or on a remote, and a later push must not land on someone else's branch.

#### Business logic

- A session name [3] is one or more characters from `[a-z0-9-]`. Any other name is refused ("invalid-name") and nothing changes.
- The rename happens only in a worktree root [10] ("not-a-worktree" otherwise), on a checkout [2] that is on a branch ("no-branch" when the head is detached), and only when that branch is an agent branch [6] ("not-an-agent-branch" otherwise): an agent [1] that somehow runs in the user's own checkout never renames `main`.
- The wanted name is `agent-<name>`. Taken names are every local branch and every remote-tracking branch on any remote (the remote's prefix dropped), plus `agent-data` whether or not the repository has that branch yet, minus the branch the checkout is on right now. The branch becomes the first free one of `agent-<name>`, `agent-<name>-2`, `agent-<name>-3`, and so on. An agent naming its work `data` therefore gets `agent-data-2`.
- When the first free name is the branch the checkout already carries, suffixed or not, nothing changes and that name is answered: asking again for a name already held never drifts to the next suffix, and the checkout's own pushed copy does not count as taken.
- Otherwise the branch is renamed in place: a rename, not a new branch, so the birth branch [5] leaves nothing behind. The checkout's directory keeps its name; a branch link [7] carries the new one.
- When the rename fails because the name exists after all (a sibling checkout took it in the same moment), the taken names are read again and the next free suffix is tried, up to three attempts in all. Any other failure surfaces.
- The name answered is the branch the checkout ends on.

### Removing a checkout and what it leaves

#### Context

**Business logic story**: reclaiming [9] (`reclaim.ts`) decides whether a checkout may go and, having decided, removes it through the operations here; the product's own delete of an agent the user chose to throw away uses the same removal on its own.

#### Business logic

- Removal asks git to remove the worktree plainly first. When git refuses, the removal is retried with force, and the line "[branches] forced removal of worktree <path> (git called it unclean)" is written to standard error: after the caller's clean check passed, git's refusal means an ignored build artifact or a state not anticipated, and such a thing must not strand a checkout [2] forever, but forcing past unknown state is said out loud rather than done silently. A path git never registered, or already removed, is not an error, so a removal can run twice.
- Deleting a branch that holds nothing uses git's forced delete: git's own "merged" test asks the wrong question, since the caller proved the tip to be a commit the remote already has. A branch that will not delete is a leftover name, not lost work, so the failure is ignored.
- Pruning drops git's administrative records of worktrees whose directories are gone (a crash, a directory removed by hand). It never removes a live worktree and never fails the caller.

### What the remote has

#### Context

**Problem**: nothing local must ever be the last copy of work. The one question every keep-or-remove decision reduces to is "is this recoverable from the remote", not "how did the agent end".

#### Business logic

A branch is on the remote when the local branch exists, the remote-tracking branch `origin/<branch>` exists, and the local tip is the remote tip or an ancestor of it (the remote may be ahead, when someone pushed on top). A branch pushed and then committed to again is not on the remote. Only the local remote-tracking refs are read, never the network: the push that put a tip on the remote is what writes them, so the answer is at most behind, never ahead of the truth. Anything unreadable answers "not on the remote". A repository with no remote therefore keeps every checkout [2], which is the honest outcome: there is nowhere to recover the work from. Whether the repository has any remote configured at all is a separate read, false when unreadable, so a caller can skip a whole pass of doomed pushes rather than fail one checkout at a time.

### When a checkout is clean

#### Context

**Business logic story**: the package commits nothing on an agent's [1] behalf. A checkout holding uncommitted work is one the caller keeps, and the agent is told (`SKILL.md`) to finish only once `status` reports its checkout clean.

#### Business logic

A checkout [2] is clean when git's status lists nothing: no modified, staged or deleted tracked file, and no untracked file. Ignored files do not count. When git cannot answer, the read fails rather than answering "clean", so the caller keeps the checkout instead of guessing.

### The worktrees git knows

#### Context

**Business logic story**: a caller that wants git's own view of the worktrees, the project's checkout included, rather than the directories on disk.

#### Business logic

The list of worktrees registered with git gives each worktree's path, the commit checked out, and its branch, absent when the head is detached. Other attributes git reports (bare, locked, prunable) are ignored. A failure to list yields an empty list, never an error.

### A checkout's size on disk

#### Context

**User story**: the dashboard labels a checkout's Remove button, and `list --sizes` labels each row, with how much disk removing the checkout gives back.

#### Business logic

The size is read with `du`, summing the checkout [2] without following the links to the user's dependency trees, so the number is the checkout's own. Kilobytes are converted to bytes. Anything that stops the read from producing a number (a missing directory, a `du` that is absent, as on Windows, output that is not a number, or a read taking longer than five seconds) yields "unknown" rather than an error or a zero: a missing number costs nothing, while a failure would cost the listing it sits in.
