What the tests cover:

- **Git time budgets** - each real git command the package runs is checked against the budget it should get: network operations (push, clone, fetch, pull) and creating a worktree get the longest budget; local mutations (staging, committing, initializing, checking out a path, removing or pruning worktrees) get the intermediate one; pure reads (listing files, status, revision and history queries, diffs, showing a blob, remote and ref lookups, ref enumeration, branch and worktree listings) get the shortest. An unrecognized subcommand, and an empty command, are treated as local mutations rather than as network operations.
- **The budgets stay distinct** - the three budgets are pinned to different values, and a network operation is verified to get far more time than a read, so nobody can widen reads to accommodate a slow operation and let a hung read hold a daemon.
- **Pushing** - a failed push comes back as an error carrying git's own reason rather than the command echoed back; a push that times out says it timed out instead of reading like a rejected push; a timeout is told apart from a git rejection; and the reason shown for a failure is git's own `fatal:` line, not the exec preamble, else the message as given.
- **Classification survives command options** - leading global options, options whose value is the following word, and options carrying their value inline all leave the real subcommand — and, for worktree commands, its distinction between creating and listing — correctly identified.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
