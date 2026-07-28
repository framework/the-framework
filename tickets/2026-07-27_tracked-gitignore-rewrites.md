Status: open
GitHub: [#1298](https://github.com/gemstack-land/the-framework/issues/1298)

# The daemon rewrites the tracked .the-framework/.gitignore per user, making every checkout dirty and conflicting with clean-slate deletions

## TLDR

`.the-framework/.gitignore` is a committed file that every daemon rewrites lazily: `ensureSessionsIgnored` (`packages/the-framework/src/sessions.ts:78`) appends per-user un-ignore rules (derived from `git config user.email`) whenever that user's lines are missing. So every machine/identity mutates a tracked file as a side effect of a session ending, the session auto-commit (#1179) commits the mutation, and anyone deleting the file (clean slate) collides delete-vs-modify with every checkout whose daemon just rewrote it — the exact conflict reported on Discord ("gitignore is random").

## Why it matters

A file only machines write should not be shared through git: it makes every checkout dirty, generates recurring merge conflicts across machines, and burned a real user session on a conflict-markered file.

## Fix directions (from the issue)

1. Stop tracking the file: seed it locally per checkout, have it ignore itself (un-ignore rules work untracked). One-time migration: `git rm --cached .the-framework/.gitignore` + root ignore. Removes the whole class.
2. Or drop the per-user lines: one glob (`!*/`, `!*/sessions/`, `!*/sessions/**`) written once at seed time, never rewritten. Smaller, but the file stays tracked and clean-slate deletions still conflict once.

Note: #1312 (the option-2 glob fix, kept as its own issue) was closed on 2026-07-28; option 1 explicitly stayed here as the maintainer's call.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1298](https://github.com/gemstack-land/the-framework/issues/1298), created 2026-07-27, no labels, 0 comments.
