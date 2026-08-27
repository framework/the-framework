Running git on a caller's behalf: every command gets a time budget matched to its cost, a command killed for outrunning its budget is reported distinctly from one git rejected, and a failure is reduced to the one line worth showing.

## Business logic — TL;DR

- **Every git command gets a time budget matched to its cost** - reads get the shortest budget, ordinary local mutations a longer one, and anything touching the network or writing a whole checkout the longest.
- **A timeout is not a git failure** - a command killed for outrunning its budget is reported as a timeout, recognisable across package boundaries, so a caller can clean up after an interrupted checkout creation without mistaking git's own refusals for one.
- **"Not a repo" is distinguishable from "git failed"** - a directory can be asked whether it sits inside a git working tree; anything unreadable reads as "not a repo".
- **The checkout from anywhere inside** - from any directory in a repo, the root of the checkout it is in can be read.
- **The line worth showing** - a failed invocation is reduced to git's own `fatal:` / `error:` / `remote:` line when there is one, else its first line.
- **Pushing a branch** - a branch is pushed to `origin` with its upstream set; the failure, if any, is that one line.

## Business logic

### Every git command gets a time budget matched to its cost

#### User story

A git command that hangs must not hold a daemon indefinitely; but a command killed halfway can do real damage — an interrupted worktree creation drops an agent into the user's own checkout, and an interrupted push may have half-landed.

#### Business logic

Each git invocation is classified by its subcommand, ignoring any leading global options so that an option's value is never mistaken for the subcommand:

- Commands that only read the index, a ref, or objects already on disk get the shortest budget.
- Commands bounded by the network — clone, fetch, pull, push, remote listing — get the longest budget, as does creating a worktree, since it writes out every tracked file.
- Everything else is treated as a local mutation and gets an intermediate budget, because writing the index on a large repo outlasts reading it.

Removing or pruning worktrees counts as an ordinary local mutation; listing them counts as a read.

#### Rationale

A single flat budget, sized for reads, once covered every git call in The Framework. That made the two slowest operations — creating a worktree and pushing — routinely die mid-flight on large repos, which is precisely the case where being killed is most destructive.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
