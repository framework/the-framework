Tests for `memory.ts` — covers `MemoryUserMemory` CRUD semantics (per-user isolation, tag-intersection filters, token-overlap recall against fact + tags, limit caps, owner-checked `forget`, idempotent unknown-id forget, `forgetAll`), `resolveRemembersSpec` precedence (per-call `false` > per-call spec > class declaration, async class declarations awaited, empty `user` rejected), the `Agent.remembers()` default (`false`), and the `setUserMemory`/`resolveUserMemory` registry round-trip.

## Facts

- Optional `tags`/`score` are omitted (not `undefined`) from entries — asserted for `exactOptionalPropertyTypes` compatibility.
