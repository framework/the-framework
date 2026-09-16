What the tests cover, with real git:

- **The data-sync error** - a project whose data branch has no remote carries a `data-sync` error naming the missing remote, said on the daemon log too, and the error is gone the first time a sync converges after a remote is added.
