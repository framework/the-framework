The one guard and confined read for client-supplied repo paths, plus the unchanged-file hover-card read (#828); every dashboard file read (this and file-diff.ts #816) goes through it.

## TLDR

- `safeRepoPath`: repo-relative only — no traversal (`..`/`.`/empty segments), no absolute path, no leading `-` (git would parse it as a flag), never into `.git` (config/credentials), ≤1024 chars, no NUL.
- `readConfinedFile(cwd, path)`: guard + realpath-confined read, null on anything unsafe/outside/unreadable.
- `readFileContent`: an unchanged file's text for the hover card, cut at `MAX_PREVIEW_LINES` (500); binary (NUL byte) yields empty text with `binary: true`.
- `cutToPreview` caps any body at 500 lines, reporting truncation.

## Problems

- Symlink escape: `resolve` does not follow symlinks, so `src/link.txt -> /etc/passwd` passes a textual prefix check while the read leaves the repo. Confinement is a `realpath` on *both* sides (cwd too, which also normalizes platform links like macOS `/tmp`), then a prefix compare.
- A missing file has no realpath, so the confinement check also answers "not there" before the read.

## Facts

- Reads resolve against the checkout the caller chose, so a session's hover shows its worktree's copy, not the project root's (#815).
