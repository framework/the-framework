In-process `Map`-backed `UserMemory` (`MemoryUserMemory`) plus `resolveRemembersSpec`, the per-call/class precedence resolver for the `Agent.remembers()` declaration (#A4).

## TLDR

- `remember/recall/forget/list/forgetAll` keyed by `userId`; `forget` is owner-checked (wrong-owner and unknown ids are silent no-ops); optional `tags`/`score` fields are omitted when absent.
- `recall()` = case-insensitive token-overlap: query and `fact + tags` are tokenized (lowercase, split on non-alphanumeric, tokens < 3 chars dropped); any shared token matches. Binary yes/no, insertion order, no scoring. Tag filters intersect (entry must contain every wanted tag) before the token check.
- `resolveRemembersSpec(agentDecl, perCall)`: per-call `false` ⇒ `null`; per-call spec wins (must have `user`); else awaits the class declaration (sync or async); specs without `user` resolve `null`.

## Decisions

- Stopword filtering deliberately omitted — the 3-char floor already drops "is/a/to/the" and real stopword lists are locale-dependent; this is a "smarter than substring" baseline, not a search engine.
- Suitable for tests/dev only; production wires an ORM- or embedding-backed store via `AiConfig.memory`.

## Facts

- `UserMemoryLookup` type is the DI seam Phase 2/3 middleware uses to find the registered store without importing `agent.ts` (wired to `setUserMemory` / the `ai.memory` binding).
