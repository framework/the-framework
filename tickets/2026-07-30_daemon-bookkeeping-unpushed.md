Status: open
GitHub: [#1397](https://github.com/gemstack-land/the-framework/issues/1397)

# Daemon commits bookkeeping to local main but never pushes it

## TLDR

The daemon commits session records (`.the-framework/sessions/*`) to the local main checkout but never pushes main, so local main drifts ahead of origin until a human pushes by hand. Fix direction: either push main after the bookkeeping commit (best-effort, like the spike-lock push), or stop committing bookkeeping to main and keep it out of run baselines.

## Why it matters

Two bites so far: on 2026-07-30 local main was 15 commits ahead and a run's PR (#1380) carried 29 stale session files (run worktrees fork the local checkout's HEAD), and the same night 2 unpushed bookkeeping commits again needed a manual push. The drift silently pollutes every run started from the stale baseline.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1397](https://github.com/gemstack-land/the-framework/issues/1397), created 2026-07-30, no labels, 0 comments.
