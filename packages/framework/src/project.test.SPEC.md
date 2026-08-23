What the tests cover:

- **Activation** - a project counts as activated only when the `.the-framework/.gitignore` file installation writes is present; a `.the-framework/` directory without it does not count.
- **The repo file crawl** - the crawl asks git for tracked and untracked files while honoring the repo's ignore rules, and reports repo-relative paths de-duplicated and sorted; a path listed twice appears once, and any git failure yields no files instead of an error.
- **Git time budgets** - each real git command the product runs is checked against the budget it should get: network operations (push, clone, fetch, pull) and creating a worktree get the longest budget; local mutations (staging, committing, initializing, checking out a path, removing or pruning worktrees) get the intermediate one; pure reads (listing files, status, revision and history queries, diffs, showing a blob, remote and ref lookups, branch and worktree listings) get the shortest. An unrecognized subcommand, and an empty command, are treated as local mutations rather than as network operations.
- **The budgets stay distinct** - the three budgets are pinned to different values, and a network operation is verified to get far more time than a read, so nobody can widen reads to accommodate a slow operation and let a hung read hold the daemon.
- **Classification survives command options** - leading global options, options whose value is the following word, and options carrying their value inline all leave the real subcommand — and, for worktree commands, its distinction between creating and listing — correctly identified.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
