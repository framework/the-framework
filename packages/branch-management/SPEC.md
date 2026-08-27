Branch management for coding agents, as an npm package: one git checkout per agent under a project's `.the-framework/branches/`, named as its branch; the parent checkout's dependencies shared into it; a navigable link per branch name; and one retention rule under which a checkout is reclaimed — only once everything it holds is on the remote.

The package knows git and the filesystem, nothing else. It is the first skill of The Framework's skills-plus architecture (#1725): the same functions serve every caller — The Framework's daemon (allocation, teardown, the reclaim sweep), its dashboard (the retained-checkouts list, the Remove and Prune buttons), and an agent's own shell, through the `branch-management` command the daemon puts on the PATH of every agent it starts on its machine. What a caller knows beyond git — whether an agent is still running, whether its handoff allows a push, what a cloud hand-off already pushed — is passed in; the package never reads an agent's record.

## Business logic — TL;DR

- **The conventions** (`branch-names`) - branch names, the checkout directory layout under `.the-framework/branches/`, and the agent-id charset every path is built from.
- **Running git** (`git`) - one runner with a time budget per subcommand, and a timeout told apart from a git failure.
- **A checkout's lifecycle** (`worktree`) - create, attach, list, name, remove, prune; the reads every retention decision is built on; the project a directory belongs to.
- **A checkout as an agent gets it** (`checkout`) - the worktree, the dependencies linked in, the links refreshed: one sequence for the daemon and the command line.
- **Dependencies shared, not copied** (`worktree-deps`) - a fresh checkout gets the parent's dependency trees as directories of links.
- **Reachable by branch name** (`branch-links`, `git-exclude`) - a symlink per current branch name beside the checkouts, and a `branches` shortcut at the repo root, hidden from git.
- **Reclaiming a checkout** (`reclaim`) - the one rule: keep a dirty tree, push the branch when allowed, remove only once the remote has it, and delete a framework-minted branch that holds nothing.
- **The command line** (`cli`, `bin/`) - the same operations as commands for a shell: JSON on stdout, a reason on stderr, an exit code that tells a refusal from a usage error; the executable's directory is exported (`bin-dir`) for a caller that spawns agents.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
