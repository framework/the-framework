Cohere provider — embeddings and reranking via the `cohere-ai` SDK (v2 client); no text generation (`create()` throws with guidance).

## TLDR

- `CohereProvider` (name `'cohere'`): `createEmbedding()` → `CohereEmbeddingAdapter`, `createReranking()` → `CohereRerankingAdapter`; `create()` throws.
- Rerank: maps `topK` → `topN`, wraps documents as `{text}` objects; result rows expose `index`, `relevanceScore`, and the original input document looked up by index.
- Embed: sends `inputType: 'search_document'` and `embeddingTypes: ['float']`; reads embeddings from `response.embeddings.float`; usage tokens from `meta.billedUnits.inputTokens` (used for both prompt and total).

## Facts

- The SDK client is `CohereClientV2` constructed with `{token}` (not `apiKey`); dynamic import behind `lazyClient` keeps `cohere-ai` an optional dependency.
