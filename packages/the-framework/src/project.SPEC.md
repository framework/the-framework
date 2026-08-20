Read-only project helpers: whether a repo has The Framework installed, listing its files, and running git with a time budget fitted to each operation.

## Flows

- A repo counts as activated when the ignore file the install writes exists — the file that keeps the framework's transient state off the repo's branches. Writing it is a separate concern.
- The file crawl lists everything git sees (tracked and untracked, honoring ignores) and yields nothing rather than failing.
- Git operations get one of three time budgets: read, local write, or network/whole-checkout.
- "Is this a git repo at all" is answered separately, so a project that cannot host agents is told apart from git failing.

## Rationales

- The ignore file is the activation marker so a repo can never look activated while it still lacks the one protection activation is about.
- The time budget is fitted to each git operation because killing a slow push or checkout mid-flight can corrupt real work, while a hung read must not hold the daemon for minutes.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
