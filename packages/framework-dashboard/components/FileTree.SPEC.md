The project panel's file tree — a context picker, not an editor: clicking a file toggles it in the run's Context, the same set the other context pickers feed.

## TLDR

- Per-file git-status marks, read from the selected session's worktree and refreshed as it edits, roll up to folders so dirty work is spottable even while a folder is closed.
- A filter box narrows to matching files, and zero matches say so instead of rendering an empty pane that reads as broken.
- Every file previews on hover — its diff when changed, its contents when not — with the tree's own status deciding which.
- Localhost-only: with no checkout to list (the relay), the tree renders nothing.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
