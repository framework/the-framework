---
"@gemstack/framework": minor
---

Add a file tree to the dashboard's project panel (#492). It lives as the first tab in the right rail (Files · Docs · Log) and is a file-level context picker: a lazy, collapsible tree (animate-ui Files) built from `git ls-files`, where ticking a file adds it to the run Context — the same set the `#` picker and whole-repo Context selector feed. Per-file git-status dots (untracked/modified/deleted) come from a new `onProjectFileStatus` RPC, rolled up to folders.

Also refines the project action bar: git status folds inline on the left; Open on GitHub / Open folder / Open in editor become icon-only buttons with tooltips (a small Base UI Tooltip, no Radix added); and Preview is renamed Serve — a play button that becomes a segmented Open ↗ / Stop ⏹ control while serving.
