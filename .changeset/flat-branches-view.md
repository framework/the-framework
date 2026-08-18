---
'@gemstack/the-framework': minor
---

Agent checkouts now live at `.the-framework/branches/`, each in a directory named as its branch (`tf-agent-<id>`, enabled by #1581's slash-free names), with a relative `branches` shortcut at the repo root — so `cd branches/<name>` reaches any session's checkout by the name the dashboard shows (#1580). When a session renames its branch, a background pass adds a sibling symlink under the new name, so a rename costs a link instead of moving a checkout under a live agent. Nothing is migrated: checkouts at the old `.the-framework/worktrees/` location keep working (every reader and path lookup covers both roots), are linked into the view by their branch, and drain out via the existing reclaim sweep. Only the framework's own links are ever created or removed — a user's file, directory, or symlink at any of these paths is left alone.
