Persistence contract + reference stores for paused standalone (top-level) agent runs awaiting client-tool results or an approval decision.

## TLDR

- `AgentRunState`: replay-ready snapshot — full `messages` history, `pendingToolCallIds`, cumulative `stepsSoFar`/`tokensSoFar`, `pauseKind` discriminator (`'client_tool'` | `'approval'`), optional `pendingApprovalToolCall` payload, opaque host `meta`.
- `AgentRunStore` interface: `store` / `load` (non-destructive peek) / `consume` (atomic read+delete).
- `newAgentRunId()`: `crypto.randomUUID()` with a timestamp+random fallback.
- `InMemoryAgentRunStore` (Map-backed, single-process) and `CachedAgentRunStore` (over a caller-supplied `CacheAdapter`) — both thin subclasses of the shared bases in `run-store-base.ts`.

## Decisions

- `load` vs `consume` split: hosts can `load()` to render a "waiting for approval" view on GET without burning the run, then `consume()` on the resume POST so a forged/replayed `runId` never reads twice.
- Run ids are deliberately unguessable — a `runId` is a capability handle to a parked conversation.
- `pauseKind` defaults to `'client_tool'` when absent so pre-approval-support snapshots stay readable.
- Default TTL 5 minutes / key prefix `'gemstack:ai:agent-run:'` for `CachedAgentRunStore` — long enough for a browser round-trip, short enough that abandoned runs GC promptly.

## Facts

- Mirrors the sibling `SubAgentRunSnapshot`/`SubAgentRunStore` family (`sub-agent-run-store.ts`) — shared pause vocabulary so hosts persist top-level and sub-agent pauses the same way.
- The SDK bundles no cache: `CachedAgentRunStore` requires `{ cache: CacheAdapter }` (see `cache-adapter.ts`).
- `meta` is treated as opaque JSON, never read by the framework (for rehydrating request context like `{ userId, threadId, agentSlug }`).
