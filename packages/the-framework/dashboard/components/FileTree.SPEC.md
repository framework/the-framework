The project panel's file tree — a context picker, not an editor: clicking a file toggles it in the Context, the same set the other context pickers feed.

## TLDR

- Per-file git-status marks, read from the selected agent's worktree and refreshed as it edits, roll up to folders so dirty work is spottable even while a folder is closed. A file says which change it is; a folder only says that something under it changed.
- Folders are the browser's own disclosure element, so open/closed state and keyboard operation are not ours to implement. They used to be a vendored animation library — a copied component registry rather than a dependency, and exempted from type-checking — for an expand animation on a side panel.
- A filter box narrows to matching files, and zero matches say so instead of rendering an empty pane that reads as broken.
- Every file previews on hover — its diff when changed, its contents when not — with the tree's own status deciding which.
- Localhost-only: with no checkout to list (the relay), the tree renders nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
