Read-only project helpers: whether a repo has The Framework installed, what its dependencies suggest about it, listing its files, and running git with a time budget fitted to each operation.

## TLDR

- A repo counts as activated when the framework's marker directory exists; creating it is a separate concern.
- Detection signals are the dependency names from the project's package manifest; a from-scratch project simply has none.
- The file crawl lists everything git sees (tracked and untracked, honoring ignores) and yields nothing rather than failing.
- Git operations get one of three time budgets — read, local write, or network/whole-checkout — because killing a slow push or checkout mid-flight can corrupt real work, while a hung read must not hold the daemon for minutes.
- "Is this a git repo at all" is answered separately, so a project that cannot host agents is told apart from git failing.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
