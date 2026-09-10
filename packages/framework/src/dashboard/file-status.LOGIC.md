Reads the working-tree state of every changed file in a checkout, from one `git status --porcelain` read, so the dashboard's file tree can mark each entry: an untracked file (`??`), a deleted one (a `D` in either status column), and anything else that changed (modified, added, renamed, copied) as modified. A rename marks the new path, since that is the one that exists, and a path git quoted for its special characters is unquoted. When the directory is not a git repository or git fails, the answer is an empty map rather than an error. The porcelain parser is shared with the handoff summary's read of the files an agent changed and never committed.

## Business logic — TL;DR

- **Three states per file** - `??` is untracked, a `D` in either column is deleted, every other change is modified, keyed by repository-relative path.
- **Renames and quoting** - a rename is recorded under its new path; a quoted path loses its surrounding quotes.
- **Forgiving** - a failed git read or a directory that is not a repository yields no statuses at all.
