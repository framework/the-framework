---
'@gemstack/the-framework': minor
---

Agent checkouts now live at `.the-framework/branches/`, each directory named as its run branch (`tf-agent-<id>`), and the repo root gets a `branches` symlink pointing there — so `cd branches/<name>` reaches any session's checkout by the name the dashboard shows (#1580, enabled by #1581's slash-free branch names). A background daemon pass migrates pre-existing checkouts out of the old `.the-framework/worktrees/` location with `git worktree move`, skipping any checkout whose agent is still running and leaving anything it cannot move for a later pass; the symlink is only created when nothing already sits at that path, so a user's own `branches` file or directory is never clobbered.
