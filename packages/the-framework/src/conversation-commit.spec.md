The daemon-side conversation committer: debounced, path-scoped git commits of chat files recorded on the **main checkout** (a run's worktree sweeps its own conversation at teardown; the main checkout has no such moment).

## Decisions

- Never `git add -A`: the pathspec names only the conversations directory and the per-user sessions glob, so the user's in-progress work cannot ride along and their index is left alone.
- Debounced on an idle window — a commit per chat turn would bury the project's real history — with a max-wait cap so a conversation that never goes idle still lands.
- Never assumes it is alone: a locked index or an in-progress rebase/merge means somebody is mid-operation — skip and retry next window; a failed commit is swallowed.

## Facts

- The sessions pathspec uses git's `:(glob)` magic so `*` stops at path separators — a plain wildcard would reach further down `.the-framework/` than intended.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
