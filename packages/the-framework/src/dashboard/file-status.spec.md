Per-file git status for the panel's file tree (#492): one `git status --porcelain` read mapped to repo-relative path → `untracked | modified | deleted` (matching the animate-ui Files `gitStatus`).

## Facts

- `??` = untracked; a `D` in either column = deleted; anything else (M/A/R/C…) = modified; renames map to the *new* path; surrounding quotes on special-char paths are stripped (escapes left as-is).
- Forgiving: a non-repo or failed git yields `{}`.
