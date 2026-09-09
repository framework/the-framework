Hides a path from git without touching any tracked file: one ignore rule is appended to `info/exclude` in the repository's common git directory, the ignore file that is git's own rather than the project's, so no `.gitignore` changes and the user never sees a diff. The rule goes in the common git directory rather than in a worktree's own because git reads excludes only from there; one line, written once, covers every worktree of the repository, an agent's checkouts included.

## Business logic — TL;DR

- **Written once** - a rule already present as a line of the file, ignoring surrounding whitespace, is left alone; otherwise it is appended on a line of its own (after a newline when the file does not end with one), and the `info` directory is created when it is missing.
- **Where the file is** - the common git directory is asked from git and resolved against the repository when git answers with a relative path; an empty answer means nothing is written.
- **Failure is the caller's call** - outside a repository, or with a git directory that cannot be written, the write fails with git's or the file system's error and the caller decides whether that matters; the checkout code in `file-branch.ts` treats it as best effort and keeps the checkout.
