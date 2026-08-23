Reads the working-tree state of every changed file in a checkout, so the dashboard's file tree can mark each entry as untracked, modified or deleted.

## Business logic — TL;DR

- **One state per changed file** - each changed file, addressed by its repo-relative path, is reported as untracked, deleted, or modified; anything that is neither untracked nor a deletion counts as modified.
- **A renamed file is reported under its new path** - the tree marks the file that actually exists, not the name it was moved away from.
- **Never fails the caller** - a directory that is not a git checkout, or a git command that errors, yields "nothing changed" rather than an error, so the file tree still renders.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
