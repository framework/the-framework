`fileSearch()` tool factory for hosted vector-store retrieval (#B8 Phase 2) with an optional local pgvector fallback (Phase 3).

## TLDR

- Builds a `FileSearchTool` tagged with `FILE_SEARCH_MARKER` (`Symbol.for('rudderjs.ai.file-search')`, cross-realm-safe like the computer-use/handoff markers) plus `isFileSearchTool` typeguard.
- The load-bearing piece is `providerHint: { type: 'file-search', vector_store_ids, filters?, max_num_results? }` — the OpenAI adapter substitutes its native `file_search` block (search runs server-side, results land in the assistant message, no agent-loop tool round-trip); the Gemini adapter emits its native `fileSearch` block.
- Non-native providers see the placeholder `{ query: string }` function-call schema; without `fallback` there is no `execute` (they'd pause as a client tool — degraded). With `fallback` (model/column/embedWith/... = `SimilaritySearchOptions` minus name/description), `execute`/`toModelOutput` are lifted from `similaritySearch` so the same agent prompt works against local pgvector.
- `normalizeWhere` lowers the sugar `{ key: value }` map to typed OpenAI filters: single key → bare `eq` (no `and` wrapper, per OpenAI's recommended shape), multi-key → `{ type: 'and', filters: [eq...] }`; typed `eq/ne/gt/gte/lt/lte/and/or` shapes pass through.
- Validation: at least one store id required; empty `where` sugar object throws.

## Decisions

- Default tool name is literally `file_search` — OpenAI's model is trained on that identifier; overridable but usually shouldn't be.
- The fallback's inner similaritySearch tool gets the OUTER name/description so structural identity (and the agent prompt) stays identical across hosted and self-hosted RAG.
- Mixing store ids from different providers in one tool is unsupported in v1.
