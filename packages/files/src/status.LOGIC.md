Reads the working-tree state of every changed file in a checkout [1], from one `git status --porcelain` read, so the Files tab's tree can mark each entry: an untracked file (`??`), a deleted one (a `D` in either status column), and anything else that changed (modified, added, renamed, copied) as modified. A rename marks the new path, since that is the one that exists, and a path git quoted for its special characters is unquoted. When the directory is not a git repository or git fails, the answer is an empty map rather than an error.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **Three states per file** - `??` is untracked, a `D` in either column is deleted, every other change is modified, keyed by repository-relative path.
- **Renames and quoting** - a rename is recorded under its new path; a quoted path loses its surrounding quotes.
- **Forgiving** - a failed git read or a directory that is not a repository yields no statuses at all.
- **One vocabulary with the commits' changes** - the file states also include added, a file a commit created, which only the reader of an agent's [2] committed changes gives (`tree.ts`); this read never does, since a new file on disk is untracked.
