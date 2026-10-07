What the tests cover:

- **Saving** - a store write that fails answers the typed error "failed to save preferences" instead of failing the call, so the dashboard can show it.
- **Patching** - the merged result the store produced is handed back, so the caller adopts what is now stored and a stale tab converges; a merge write that fails answers the same typed error.
