Makes git ignore a path without touching anything the user's repository tracks: the rule is added to git's own private exclude list rather than a committed `.gitignore`, so no tracked file changes and no diff ever shows up. The rule is recorded once for the whole repository, which covers every worktree of it, and adding a rule that is already there does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
