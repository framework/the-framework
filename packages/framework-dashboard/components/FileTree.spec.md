The project panel's collapsible file tree (#492): a file-level Context picker built from the flat `git ls-files` list, with per-file git-status dots and hover previews.

## TLDR

- Builds a nested `TreeNode` from repo-relative paths; renders animate-ui `Files`/`Folder*`/`FileItem` primitives, dirs and files locale-sorted.
- A context PICKER, not an editor: clicking a file toggles it in the run Context — the same set the `#` chips and whole-repo Context selector feed (#504).
- Polls `onProjectFileStatus(projectId, runId)` every 8s for untracked/modified/deleted dots, scoped to the selected run's worktree (#815) so dots agree with the action bar's branch/Serve (worktree-resolved since #738); `foldersFromStatus` rolls statuses up to ancestor folders (mixed children read as `modified`).
- Filter input narrows to matching files with an "N of M files" count; a zero-hit query renders a message instead of an empty pane, which read as broken (#948).
- Every file wraps in `FilePreviewHover` (#816/#828); the tree's own status map supplies `changed`, so the card needs no second server lookup.
- Renders nothing when `files` is empty — localhost-only, the relay has no checkout.

## Decisions

- No `title` on file items: the hover preview already leads with the full path, and native tooltips are the slow system ones the dashboard dropped (#1149).
- `EMPTY_STATUS` is a stable module constant so the `useMemo` over `status` doesn't re-run for a fresh empty object.
- `Files` gets `p-0` (overriding the primitive's own `p-2` — the surrounding panel already sets the inset) and carries its own `overflow-y-auto`: it is the one panel with no outer scroller, so a long repo scrolls here rather than stretching the rail.
