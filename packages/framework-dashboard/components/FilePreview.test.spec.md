Tests for `FilePreview.tsx` — covers lazy mounting (nothing fetched until the card opens), the `changed`-picked diff-vs-content read, run-worktree vs project-checkout addressing, and the null/binary/truncated/empty/error states (#816/#828).

## Facts

- Pins that a closed `FilePreviewHover` fetches nothing: the tree renders one per changed file, so fetching on mount would be a git diff per file nobody asked to see.
- Pins that an unchanged file (`changed={false}`) costs no `onFileDiff` call — the tree's own status picks the read.
- A rejected read must not be an unhandled rejection; the card stays on its "Reading the diff…" message.
