Per-file diffs for the dashboard: one changed file's patch for the tree's hover card (#816) and the run view's Changes list with line counts (#817), read against whatever checkout the caller resolved (a session's worktree, not the project root, #815).

## TLDR

- `readFileDiff(cwd, path, status)`: the capped unified diff for one file — tracked files diff against `HEAD` (falling back to a plain working-tree diff in a repo with no commits), untracked files render as all-added from their contents; null when unsafe/unreadable/no diff; binary detected via NUL bytes or git's `Binary files` line.
- `readFileChanges(cwd, statuses)`: every changed file with +/- counts via one `git status` + one `git diff --numstat` (two git calls total, not one per file); untracked files get their line count from disk; sorted by path so a live session's list does not reshuffle.
- `parseNumstat` is the single parser for the `added<TAB>removed<TAB>path` grammar (with `-` for binary), shared with run-handoff.ts.
- Re-exports `safeRepoPath` (moved to file-read.ts with #828) so this stays the import site it has been.

## Problems

- This was the first read taking a caller-supplied path, so the guard lives at the entry (`safeRepoPath` gates every caller) rather than at call sites.
- `git diff --no-index` exits non-zero on any difference, so it cannot be used for untracked files without reading a difference as a failure — hence the all-added rendering.

## Decisions

- Tracked files diff against `HEAD`, not the index, so staged changes still show — matching `git status --porcelain`, which is what dotted the file in the first place.
- `parseNumstat` was deduplicated because the two copies had already drifted on paths containing a tab (one rejoined it, the other dropped the line).
- Patches drop git's `diff --git`/index/mode preamble, keeping only `---`/`+++`/hunks.
