Topics: [the-framework]
GitHub: [#453](https://github.com/gemstack-land/the-framework/issues/453)

# Git worktrees

## TLDR

Use Git worktrees so Claude Code can work on multiple tasks of the same repo in parallel. Decomposed into #735 (worktree lifecycle module — merged), #736 (per-worktree concurrency), #737 (archive + reconcile), #738 (dashboard aggregation), to be built in that order; #736 and #737 carry run-lifecycle decisions that need settling before their build.

## Why it matters

Parallel sessions per repo are the framework's core throughput story — without worktrees, concurrent runs would trample each other's checkouts. Originally flagged as "probably needed fairly soon, complexity unknown, maybe post-MVP"; the decomposition made it concrete and the lifecycle foundation is already merged.

## Source

Imported from GitHub issue [gemstack-land/the-framework#453](https://github.com/gemstack-land/the-framework/issues/453), created 2026-07-13, label: `the-framework ♻️`, 1 comment.

### Original description

If we want Claude Code to be able to work on multiple tasks at the same time for the same repo, we'll need to use Git worktress.

We'll probably need it fairly soon, but I ain't sure how complex it is to fully implement, so we can make it post-MVP.

### Notes from the GitHub thread

- Decomposed into #735 (lifecycle module, merged), #736 (per-worktree concurrency), #737 (archive + reconcile), #738 (dashboard aggregation). Build order #735 → #736 → #737 → #738; #736 and #737 carry run-lifecycle decisions to settle before their build.
