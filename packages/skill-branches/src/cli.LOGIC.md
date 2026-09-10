Gives an agent [1] in a shell, and the user, the `branches` command over this package: `create`, `attach`, `name`, `status`, `list`, `remove` and `prune`, the same operations the daemon calls, so one implementation serves every surface. Every run prints one JSON document on stdout, at most one line for a person on stderr, and exits with a code that says how it went: 0 for a result, 1 for a refusal or a git failure, 2 for a command line that could not be read.

## Context

**User story**: an agent [1] runs `npx branches status` to learn its branch and whether its checkout [2] is clean, and `npx branches name <name>` to name its work, as its `branches` skill [3] instructs. The user, or the daemon on the user's behalf, runs `create`, `attach`, `list`, `remove` and `prune` from the project's checkout or from inside any agent's checkout. A program parsing stdout learns the outcome and its reason; a person reading stderr learns why in one line.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[3] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.
[4] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[6] branch link: a symbolic link under `.branches/`, named as the branch a checkout is on now and pointing at that checkout's directory, so `.branches/<branch>` reaches the checkout by its current branch name.
[7] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.
[8] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.
[9] reclaim: removing a finished agent's checkout once its work is on the remote.
[10] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.

## Business logic — TL;DR

- **One JSON document, one line, an exit code** - the result or the refusal on stdout, the reason for a person on stderr, exit 0 for a result and 1 for a refusal or a git failure.
- **A command line that cannot be read** - an unknown command, an unknown flag or the wrong argument count prints the usage on stderr, nothing on stdout, and exits 2.
- **Where a command acts** - `create`, `attach`, `list`, `remove` and `prune` act on the project found from the `.branches/` layout, even from inside a checkout; `name` and `status` act on the checkout the command runs in.
- **Outside a repository** - a command that needs one is refused as `not-a-repo`; only git's own "not a git repository" reads as that.
- **An agent id is checked before anything runs** - `create`, `attach` and `remove` refuse an id outside the charset, or `data`, as `invalid-id`, before the repository is even looked for.
- **`create`: a checkout for a new agent** - `.branches/agent-<id>` on the fresh branch `agent-<id>`, from `--base` or the project's head, fully set up.
- **`attach`: a checkout for a continued agent** - `.branches/agent-<id>` on the branch named, taken as given, fully set up.
- **`name`: the agent names its work** - the branch becomes `agent-<name>`, suffixed when taken, the name got is printed, and the branch links follow at once; four refusals.
- **`status`: where the agent is and whether it may finish** - the checkout's path, its branch, whether it is clean and whether it is on the remote; refused for a directory git does not know as a worktree.
- **`list`: every checkout under `.branches/`** - a bare JSON array, one row per checkout directory, with its branch when git knows it and its size on request.
- **`remove`: reclaim one checkout** - under the reclaim rule, pushing unless `--no-push`, with a line for each refusal and `no-checkout` for a missing one; the branch links follow at once.
- **`prune`: reclaim every checkout** - `remove` for each checkout directory, reporting the removed and the skipped, never refusing as a whole.

## Business logic

### One JSON document, one line, an exit code

#### Context

See `## Context`.

#### Business logic

Every command that runs prints exactly one JSON document on stdout: the result, or the refusal. `list` answers with a bare JSON array; every other result and every refusal is an object whose `ok` tells the two apart. A refusal is a rule saying no (a dirty tree, a name that is not a session name [4]): stdout carries `{"ok": false, "reason": "<reason>"}` plus whatever the rule adds (the branch, the path, the id), stderr carries one line for a person, and the exit code is 1. A command that fails in git is reported like a refusal, with the reason `git-failed` and git's own line as `detail`, on stdout and on stderr, exit code 1. A result exits 0; stderr then carries nothing, except the warning a forced removal writes (`worktree.ts`).

### A command line that cannot be read

#### Context

**Problem**: a malformed command line has no rule to answer it, and a program parsing stdout must never mistake the usage text for an outcome.

#### Business logic

An unknown command, an unknown flag or the wrong number of arguments never reaches a rule: the usage text is printed on stderr, preceded by what was wrong for a flag or a count ("expected 1 argument(s), got 2"), nothing is printed on stdout, and the exit code is 2. Flags are read strictly: any option a command does not declare is an error. A name or id beginning with `-` ends here too, since at the command line it reads as a flag.

### Where a command acts

#### Context

**User story**: an agent [1] runs `npx branches` from inside its checkout [2], and the user runs it from the project's checkout; either way the command acts on the project.

#### Business logic

The working directory decides. `create`, `attach`, `list`, `remove` and `prune` act on the project: the checkout [2] whose `.branches/` directory the working directory is under, or, when it is under none, the checkout containing the working directory (the rule is in `worktree.ts`). `name` and `status` act on the checkout containing the working directory, found from anywhere inside it. `status` alone also takes the path of a checkout root as an argument, resolved against the working directory.

### Outside a repository

#### Context

See `## Context`.

#### Business logic

A command that needs a repository and runs outside one is refused as `not-a-repo` ("not inside a git repository"): there is nothing to act on. Only git's own "not a git repository" answer reads as that; a missing git, a timeout or a corrupt repository stays the failure it is, reported as `git-failed`.

### An agent id is checked before anything runs

#### Context

**Problem**: an agent id [5] becomes a directory name under `.branches/`, so an id holding a path separator or `..` could name a directory outside it.

#### Business logic

`create`, `attach` and `remove` take an agent id [5]. An id outside letters, digits, `_` and `-`, or the id `data`, is refused as `invalid-id` ("<id> is not an agent id") before anything else runs, before the repository is even looked for, so no id can name a directory outside `.branches/` (the id rules are in `branch-names.ts`).

### `create`: a checkout for a new agent

#### Context

See `## Context`.

#### Business logic

`create <id> [--base <ref>]` makes the checkout [2] for a new agent [1]: `.branches/agent-<id>` on the fresh branch `agent-<id>`, from `--base` when given and from the project's head otherwise, set up with the user's dependencies, the skill [3] links and the branch links [6] (the sequence is in `checkout.ts`). The result is `{"ok": true, "path": …, "branch": …}`. A branch or directory that already exists is git's own failure, `git-failed`.

### `attach`: a checkout for a continued agent

#### Context

See `## Context`.

#### Business logic

`attach <id> <branch>` makes the checkout [2] for a continued agent [1] on the branch named, taken as given, a `/` in it included: `.branches/agent-<id>` with that branch checked out, recreated from the remote's copy when it is gone locally and from the project's head when it is gone everywhere (`worktree.ts`), then set up exactly as `create` does. The result is `{"ok": true, "path": …, "branch": …}`.

### `name`: the agent names its work

#### Context

**User story**: before its first change the agent [1] names its work; it asked for a name and reads back the one it got, and the user then reaches its checkout [2] at `.branches/agent-<name>`.

#### Business logic

`name <name>` renames the branch of the checkout [2] the command runs in to `agent-<name>`, suffixed `-2`, `-3`, and so on when the name is taken (the naming rules are in `worktree.ts`), and prints the branch it got as `branch`. Four refusals: `invalid-name` ("<name> is not a session name: use [a-z0-9-]+"); `not-a-worktree` ("<checkout> is not a git worktree"); `no-branch` ("<checkout> is on no branch"); `not-an-agent-branch` ("<checkout> is not on an agent branch; only agent-* branches are renamed"), so an agent that somehow runs in the user's own checkout never renames `main`. After a rename the branch links [6] under `.branches/` are reconciled at once, so `.branches/agent-<name>` reaches the checkout now and not at the daemon's next pass.

### `status`: where the agent is and whether it may finish

#### Context

**User story**: the agent [1] runs `npx branches status` first, to learn which branch it is on and therefore what its skill [3] tells it to do, and last, since it may finish only when the checkout [2] is clean.

#### Business logic

`status [path]` reports on the checkout [2] the command runs in, or on the checkout root given: `{"ok": true, "path": …, "branch": …, "clean": …, "onRemote": …}`. `path` is the checkout's root. `branch` is the branch checked out, absent when the head is detached. `clean` is true when nothing is uncommitted and nothing is untracked; ignored files do not count (`worktree.ts`). `onRemote` is true when the branch's tip is the tip of `origin/<branch>` or an ancestor of it, read from the local remote-tracking refs (`worktree.ts`), and false when there is no branch. A path that is not a worktree root [7] is refused as `not-a-worktree` ("<path> is not a git worktree"), the path in the refusal: a directory left under `.branches/` that git does not know is never reported as being on the user's branch. Given a path, the command answers about that directory even outside a repository: `not-a-worktree`, not `not-a-repo`. A status git cannot read is `git-failed`, never a clean checkout.

### `list`: every checkout under `.branches/`

#### Context

**User story**: the user, or the dashboard on the user's behalf, sees which agents' [1] checkouts [2] are still on disk, on which branch each is, and how much disk each would give back.

#### Business logic

`list [--sizes]` answers with a bare JSON array, one row per checkout [2] directory under the project's `.branches/` (the listing rule is in `worktree.ts`: a directory named as an agent branch [8] with a valid agent id [5]; `agent-data`, links and files are not listed). Each row carries the agent id as `agentId` and the directory's path as `path`, `branch` when the directory is a worktree root [7] on a branch, and with `--sizes` its size in bytes as `sizeBytes` when the size could be read. A directory git no longer knows as a worktree is listed without a branch, never with the user's own; an unreadable size leaves the size out rather than reporting a wrong number. A project without `.branches/`, or with an empty one, lists nothing.

### `remove`: reclaim one checkout

#### Context

**Business logic story**: the reclaim [9] decision and its refusals live in `reclaim.ts`; the command adds the missing-checkout case, the person's line for each refusal, and the push option.

#### Business logic

`remove <id> [--no-push]` reclaims [9] the checkout [2] at `.branches/agent-<id>` under the rule that only what is on the remote may go, naming `agent-<id>` as the birth branch [10], with a push to `origin` allowed unless `--no-push` is given; the command line vouches for no pushed commit and passes no hook. A missing `.branches/agent-<id>` directory is its own refusal, `no-checkout` ("no checkout for agent <id>"). The reclaim rule's refusals come through with one line each: `not-a-worktree` ("agent <id>'s directory is not a git worktree; left alone"), `no-branch` ("agent <id>'s checkout is on no branch; kept"), `dirty` ("<branch> has uncommitted work; the checkout was kept") and `not-on-remote` ("<branch> is not on the remote (<what git said, or "not pushed">); the checkout was kept"). On success the result carries the branches that went with the checkout as `branchesDeleted`, when any did, and the branch links [6] are reconciled at once, since a link named after a branch that just went is stale from this moment.

### `prune`: reclaim every checkout

#### Context

See `## Context`.

#### Business logic

`prune [--no-push]` runs `remove`'s reclaim [9] for every checkout [2] directory under `.branches/`, with the same push rule for all, and never refuses as a whole: the result is `{"ok": true, "removed": [ids], "skipped": [{agentId, reason, detail}]}`, each skipped entry carrying the refusal's reason and its one-line explanation, and the exit code is 0 even when every checkout was skipped. A git failure inside a removal itself ends the pass as `git-failed`. The branch links [6] are reconciled once for the whole pass, after the last checkout, and only when something was removed.
