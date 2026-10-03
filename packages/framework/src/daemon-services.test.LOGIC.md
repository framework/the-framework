What the tests cover, with real git:

- **The data-sync error and the local only note** - a project whose repository has no remote carries no error, only the local only note, and the daemon log names no failed sync; the note is gone the first time a sync converges after a remote is added; a remote that cannot be reached is then a `data-sync` error, and no note.
- **The provider error** - a project where two packages declare the same kind, with no line in its `package.json`, carries a `provider` error naming both and the line to write; the line naming one clears it at the next check.
