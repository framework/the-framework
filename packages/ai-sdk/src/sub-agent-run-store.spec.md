Persistence contract + reference stores for paused `Agent.asTool` sub-runs: `SubAgentRunStore` interface, `SubAgentRunSnapshot` shape, and the `InMemorySubAgentRunStore` / `CachedSubAgentRunStore` implementations (thin subclasses of `run-store-base.ts`).

## TLDR

- Snapshot: full inner `messages` up to the pause, `pendingToolCallIds`, cumulative `stepsSoFar`/`tokensSoFar`, `pauseKind` (`'client_tool'` | `'approval'`), `pendingApprovalToolCall` (approval pauses: full payload so a renderer can show "approve delete_user(id=42)?" without round-tripping), opaque host `meta`.
- Contract: `store(id, snap)`; `consume(id)` = atomic read+delete (single-use — a forged/replayed subRunId must not return data twice); optional `load(id)` = non-destructive peek for validate-then-resume pre-flight (resume paths never call it, so validation reads once and resume consumes once, no consume-then-re-store round-trip).
- `CachedSubAgentRunStore({cache, keyPrefix?, ttlSeconds?})`: bring-your-own `CacheAdapter`; cross-process when the cache is.

## Facts

- `pauseKind` absent defaults to `'client_tool'` so pre-approval-era v1.4 snapshots stay readable after upgrade.
- Resume contract per kind: `client_tool` ⇒ one tool result per pending id; `approval` ⇒ `approvedToolCallIds`/`rejectedToolCallIds` covering the single pending id.
- Default key prefix `gemstack:ai:sub-agent-run:`; default TTL 5 min — long enough for a browser round-trip, short enough that abandoned runs GC promptly.
