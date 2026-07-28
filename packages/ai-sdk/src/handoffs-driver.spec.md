Handoff-chain driver shared by the agent loop: iterates pending handoffs, builds child options, merges hop results, and strips internal fields.

## TLDR

- `MAX_HANDOFFS = 5` — hard ceiling; exceeding it throws "Likely a cycle between agents" instead of silently looping until token budgets explode.
- `driveHandoffs` (non-streaming path): loop — instantiate `spec.AgentClass`, run it via the injected `runOnce` with `buildHandoffChildOptions`, merge steps + usage, follow further `_pendingHandoff`s; the terminal hop's response wins for text/finishReason and gains `handoffPath` (class names in hop order). The streaming path has its own inline driver in `agent.ts` so chunks flow per hop.
- `buildHandoffChildOptions`: carries per-call options (signal, attachments, overrides) but replaces `messages` with the parent's carried log MINUS its leading system message — the child prepends its own `instructions()` during init, so keeping it would double-prefix.
- `mergeFinalHandoff` / `stripInternal`: merge the terminal response with accumulated steps/usage/path; strip `_pendingHandoff`/`_carriedMessages` before surfacing publicly.

## Decisions

- `RunOnce` is injected (rather than importing `agent.ts`) to avoid a runtime module cycle.
