`similaritySearch(opts)` — agent-tool factory wrapping an ORM Model with a pgvector column into a `Tool`: embeds the model-supplied natural-language `query` via `AI.embed`, runs `whereVectorSimilarTo` + `selectVectorDistance`, and returns top-K `SimilarityHit`s (#B7 Phase 2/2.5).

## TLDR

- Options: `model` (structural `{name, query()}` type — no ORM compile-time dep), `column`, required `embedWith` (`provider/model`), `metric` (default `'cosine'`), `minSimilarity`, `limit` (default 10), `scope` pre-filter callback, `name`/`description`/`projectResult` overrides.
- Execute: `AI.embed(query, {model: embedWith})` → apply `scope` to a fresh `model.query()` → `whereVectorSimilarTo(column, vector, {metric, minSimilarity})` → `selectVectorDistance(column, vector, '__rudderjs_similarity_distance__')` → `.limit(n).get()` → map rows to `{row, similarity: 1 - distance}`.
- `.modelOutput(...)`: model sees `(0.87) {json}` lines (via `row.toJSON()` when present, else the alias-stripped object) or a custom `projectResult`; the structured hit array still flows to the UI through the `tool-result` chunk.

## Decisions

- `embedWith` has NO default — fails loud at factory time so embeddings never silently route through whatever `AiRegistry.getDefault()` happens to be.
- Vector-query methods are probed at runtime (`typeof … !== 'function'` ⇒ "adapter does not implement vector queries, use Postgres + pgvector") since the QueryBuilder type is structural.

## Facts

- `similarity` is always `1 - distance` regardless of metric; for `l2`/`inner-product` it is consistent with the adapter's `minSimilarity` filter but not a normalized score.
- `scope` limits (Phase 2.5): only flat `.where()`/`.orWhere()` chains compose with the vector clause; `whereGroup`/`whereHas`/`with()` still throw at terminal time.
- Internal distance alias: `__rudderjs_similarity_distance__`; stripped from plain-object rows before JSON rendering (toJSON-bearing Models filter their own internals).
