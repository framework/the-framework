Hover-card file preview for the file tree (#816/#828): a changed file shows its git diff, an unchanged one its contents, both resolved against the selected run's worktree.

## TLDR

- `FilePreviewCard`: header (path + `DiffStat` for diffs) over `DiffView`/`ContentView`; polls `onFileDiff` or `onFileContent` (telefunc) every 5s so a card open over a still-editing session keeps up instead of freezing at hover time.
- `FilePreviewHover`: wraps children in a Base UI `PreviewCard` (350ms open / 150ms close delay, left-anchored portal popup, max-h 70vh so long bodies scroll) that mounts `FilePreviewCard` only while open.
- The `changed` prop picks which read to make — the tree already holds each file's git status, so the server never looks it up again (#828).
- `runId` scopes both reads to that session's worktree (#815); absent, the project checkout.
- Distinct states: "Reading the diff…/the file…" while loading (also after a failed read), "No change to show."/"Nothing to show." on a null result; binary/empty/truncated messaging comes from `DiffView`/`ContentView`.

## Decisions

- Hover is the preview gesture because click is already taken — it toggles the path in the run Context (#504).
- The card is its own component because a closed Base UI PreviewCard does not mount its popup: mounting *is* opening, so reads are lazy by construction with no open-state bookkeeping.
- The trigger renders `pointer-events-auto`: the tree's rows are `pointer-events-none` (only labels clickable), so it must take events back or there is nothing to hover.

## Facts

- `FileDiff` vs `FileContent` arrive on the same polled channel and are discriminated by `'patch' in value`.
