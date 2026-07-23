---
"@gemstack/the-framework": minor
"@gemstack/framework-dashboard": minor
---

A run started on a connected device is now a true peer: its file reads, diffs, git status, worktree, run-handoff, live steering, and push/open-PR all work by relaying each run-scoped RPC to the device over the #1051 token cookie, keyed by a durable per-run marker on the local daemon; push and PR run on the device's own checkout. The run view's diff and handoff panels are no longer suppressed for remote runs (#1067, slice 2). The browser preview stays local-only for now (slice 3).
