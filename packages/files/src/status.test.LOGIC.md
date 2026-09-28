What the tests cover:

- **Mapping git's status codes** - a modified file reads as modified, `??` as untracked, a deleted file as deleted, an added file as modified, and a rename marks the new path as modified.
- **Not a repository** - when git fails, the answer is an empty map rather than an error.
