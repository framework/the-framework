What the tests cover for reading a branch's state, against real git with a bare `origin`:

- **What the branch holds and where it stands** - a checkout with two commits and an uncommitted file answers `exists`, the base `origin/main`, the two commits newest first with full hashes, the two files with their line counts, `hasRemote`, not pushed, not merged, and the uncommitted path; once pushed, `pushed` is true and the pending list is empty; once merged into `main`, `merged` is true and the commit and file lists are empty.
- **Several branches, in order** - a gone branch, an agent's branch and `main` answer in the order asked, the gone one with `exists: false` and empty lists, `main` without a pending list since no checkout is on it; the command line prints the same as a bare JSON array, and `show` with no branch is a usage error naming "at least 1".
- **No remote, no base** - a repository without a remote and without a `main` or `master` answers `hasRemote: false`, no base, empty lists, nothing pushed, nothing merged.
- **The parsers** - a commit subject with spaces, an empty subject, a binary numstat entry, a renamed path read as its new name, a quoted path unquoted.
