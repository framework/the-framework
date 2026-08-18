---
'@gemstack/the-framework': minor
---

A flat `branches/` view of agent checkouts (#1580): `.the-framework/branches/` now holds one symlink per session worktree, named as the branch it is on, and the repo root gets a relative `branches` shortcut pointing there — so `cd branches/<name>` reaches any session's checkout by the name the dashboard shows (enabled by #1581's slash-free branch names). The worktrees themselves stay at `.the-framework/worktrees/`; the daemon reconciles the links in the background and at every worktree allocation, so a rename settles as a link rename and a reclaimed checkout's link disappears. Only the framework's own links are ever created or removed — a user's file, directory, or symlink at any of these paths is left alone.
