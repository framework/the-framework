The live session's changed-files panel in the run view (#817): polls the run worktree's git status and renders expandable per-file rows with diff stats.

## TLDR

- `RunChanges` polls `onRunChanges(projectId, runId)` every 8s; each `ChangeRow` shows dir/name, a status label (new/modified/deleted with tone colors), and a `DiffStat`; expanding mounts a `FilePreviewCard` with the same diff the tree's hover card shows (#816).
- `ChangesSummary` is the collapsed one-liner ("N files +a −r") shown in the action bar beside the branch (#1023); `onSummary(count, added, removed)` reports totals upward through a ref so the bar needs no second read.
- Renders nothing when there are no changes or when `open` is false — but keeps polling collapsed, since the count is the reason to open it.

## Decisions

- Derived from git, not from agent tool calls: the driver surfaces a tool's name but not its arguments by design (#165), and git is the honest source (outcome, not intent) that works for every agent.
- Diffs are read lazily: `FilePreviewCard` mounts only while a row is open, so the run view costs one `git status` + one `numstat` until a diff is asked for.
- `onSummary` goes through a ref so inline callback props don't re-fire the effect each render.

## Facts

- LIVE sessions only: a finished session is answered by the branch-addressed handoff panel (#799). Callers must not render this once the worktree is gone — `resolveRunPath` then falls back to the project root and the panel would present the user's own uncommitted files as the session's work.
- `FileChange['status']` is `untracked | modified | deleted`, labelled new/modified/deleted.
