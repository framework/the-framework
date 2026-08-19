Hides a path from git without touching any file the project owns, by writing the ignore rule into the repository's own exclude file.

## TLDR

- The rule lands in git's repository-level exclude, so it covers every worktree at once and never shows up as a change to the project.
- Idempotent: a rule already present is left alone.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
