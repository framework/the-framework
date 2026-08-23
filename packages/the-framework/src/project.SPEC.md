Answers the read-only questions The Framework asks about a project's repository — is it activated, is it a git working tree at all, and what files does it contain — and sets how long any single git command is allowed to take before it is given up on.

## Business logic — TL;DR

- **Activation is proven by one marker** - a project counts as activated for The Framework only when it carries the `.the-framework/.gitignore` file that installation writes.
- **"Not a repo" is distinguishable from "git failed"** - a project can be asked whether it sits inside a git working tree, so a caller can tell a repo that can never host a worktree from a repo where one particular git command failed.
- **The repo's file list is what git sees** - the crawl lists tracked and untracked files, honoring the repo's ignore rules, as sorted repo-relative paths.
- **Every git command gets a time budget matched to its cost** - reads get the shortest budget, ordinary local mutations a longer one, and anything touching the network or writing a whole checkout the longest.
- **Reading never fails** - an unreadable repo, a missing git, or any git error reads as "not a repo" and an empty file list, rather than raising an error.

## Business logic

### Activation is proven by one marker

#### User story

The user registers a repo with The Framework; before the framework may work in it, the repo has to be installed. The dashboard must be able to tell an installed project from a registered-but-not-yet-installed one.

#### Business logic

A project is activated exactly when the `.the-framework/.gitignore` file exists. This is the same marker installation itself checks before deciding it has nothing to do.

#### Rationale

The marker is the ignore file rather than the `.the-framework/` directory, because some other tool — or a half-finished attempt — can leave that directory behind. Keying on the ignore file means a project can never read as activated while it still lacks the very file that keeps framework state off its branches.

### Every git command gets a time budget matched to its cost

#### User story

A git command that hangs must not hold the daemon indefinitely; but a command killed halfway can do real damage — an interrupted worktree creation drops an agent into the user's own checkout, and an interrupted push may have half-landed.

#### Business logic

Each git invocation is classified by its subcommand, ignoring any leading global options so that an option's value is never mistaken for the subcommand:

- Commands that only read the index, a ref, or objects already on disk get the shortest budget.
- Commands bounded by the network — clone, fetch, pull, push, remote listing — get the longest budget, as does creating a worktree, since it writes out every tracked file.
- Everything else is treated as a local mutation and gets an intermediate budget, because writing the index on a large repo outlasts reading it.

Removing or pruning worktrees counts as an ordinary local mutation; listing them counts as a read. Any git command that outruns its budget is reported as a timeout, distinctly from git having failed on its own.

#### Rationale

A single flat budget, sized for reads, once covered every git call in the product. That made the two slowest operations — creating a worktree and pushing — routinely die mid-flight on large repos, which is precisely the case where being killed is most destructive.

### The repo's file list is what git sees

#### User story

The dashboard's file sidebars, and anything else that needs to know what a project contains, want the project as the user perceives it: the files git tracks plus the new ones they have not committed yet, and none of the build output and dependencies the repo deliberately ignores.

#### Business logic

The crawl asks git for both tracked and untracked files while honoring the repo's ignore rules, and reports the result as repo-relative paths, de-duplicated and sorted. A project that is not a repo, or where git fails for any reason, reports no files.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
