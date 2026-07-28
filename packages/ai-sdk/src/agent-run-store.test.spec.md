Tests for `agent-run-store.ts` — covers `newAgentRunId` uniqueness, `InMemoryAgentRunStore` load/consume semantics, and `CachedAgentRunStore` keying/TTL.

## Facts

- Asserts the exact default namespace key `gemstack:ai:agent-run:<id>` and 5-minute (300 s) TTL.
- Covers normalization of `undefined` cache misses to `null` (some `CacheAdapter` impls resolve `undefined`).
- Verifies single-use `consume()` vs non-destructive `load()`, and that approval-pause snapshots round-trip `pendingApprovalToolCall` and opaque `meta` verbatim.
