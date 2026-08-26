What the tests cover: the safety commit and its refusal of an implausible sweep.

- Reading what is pending: paths come out of git's raw NUL-separated listing intact (spaces included), a rename counts once, and a deleted file weighs nothing; files are counted per top-level directory, with the repository root as its own group.
- Sizes are not read once the file count is already past its limit.
- The refusal names the file count, the size when the size is what tripped it, the limits, and the directories holding most of the files; within both limits there is no refusal.
- Committing: pending work within the limits is staged and committed under the fixed message; a clean checkout is left alone; a sweep past the file limit, or a single file past the size limit, is refused before anything is staged.
- Against a real repository: a cache directory that puts the tree past the limit is refused and every file stays pending, and the same tree within a bigger limit is committed whole under the fixed message.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
