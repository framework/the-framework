Reads the working-tree state of every changed file in a checkout [1], from one `git status --porcelain` read, so the dashboard's file tree can mark each entry: an untracked file (`??`), a deleted one (a `D` in either status column), and anything else that changed (modified, added, renamed, copied) as modified. A rename marks the new path, since that is the one that exists, and a path git quoted for its special characters is unquoted. When the directory is not a git repository or git fails, the answer is an empty map rather than an error. The porcelain parser is shared with the handoff [2] summary's read of the files an agent [3] changed and never committed.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[2] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Three states per file** - `??` is untracked, a `D` in either column is deleted, every other change is modified, keyed by repository-relative path.
- **Renames and quoting** - a rename is recorded under its new path; a quoted path loses its surrounding quotes.
- **Forgiving** - a failed git read or a directory that is not a repository yields no statuses at all.
