What the tests cover, with real git:

- **The data-sync error** - a project whose data branch has no remote carries a `data-sync` error naming the missing remote, said on the daemon log too, and the error is gone the first time a sync converges after a remote is added.
- **The provider error** - a project where two packages declare the same kind, with no line in its `package.json`, carries a `provider` error naming both and the line to write; the line naming one clears it at the next check.
