Activates a repo for the framework: it becomes a Git repo if it is not one yet, gets the framework's marker directory and its ignore rules, and the activation itself is committed.

## TLDR

- Pre-existing uncommitted changes are committed first, so the install commit is clean and none of the user's work is mixed into it.
- The ignore rules keep transient run state out of Git while committing the durable record (the session archive); the quality presets are materialized so their references resolve, but regenerate per install rather than being committed.
- The ignore file is also the activation marker: it is the one file install always writes, so a repo that has it is already activated.
- Activating an already-activated repo is a harmless no-op, and any failure comes back as an error value, never a throw.
- Also finds which immediate children of a folder are their own Git repos, for adding a whole directory of projects at once.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
