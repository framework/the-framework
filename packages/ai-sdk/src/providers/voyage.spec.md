VoyageAI provider — embeddings + reranking over raw `fetch` (#B10); no chat surface (`create()` throws).

## TLDR

- `VoyageProvider` (name `'voyage'`): `createEmbedding()` / `createReranking()`; base URL `https://api.voyageai.com`, overridable.
- Embed: POST `/v1/embeddings` with `input_type` (default `'document'`, config `defaultInputType`); results sorted by `index` defensively.
- Rerank: POST `/v1/rerank` (`topK` → `top_k`); prefers Voyage's echoed `document`, falls back to input lookup by index.
- Raw `fetch`, no SDK peer dep — matches the Jina/ElevenLabs shape.

## Decisions

- `input_type` defaults to `'document'` because that's the common RAG-ingestion case (matches `similaritySearch` and `EmbeddingUserMemory` paths); query-side pipelines need `'query'`, but `VoyageEmbedExtras.inputType` is NOT actually threaded through `AI.embed()` today — widening `EmbeddingOptions` would be required; v1 ships the interface as documentation plus the per-deployment `defaultInputType` config knob.
- Result mapping is defensive against API revisions (index/document fallbacks, `?? 0` scores).

## Facts

- Voyage returns only `usage.total_tokens`; the adapter reports it as both `promptTokens` and `totalTokens`.
- Embedding models: `voyage-3`, `voyage-3-large`, `voyage-code-3`, `voyage-finance-2`, `voyage-law-2`; reranking: `rerank-2.5`, `rerank-2.5-lite`, `rerank-2`.
