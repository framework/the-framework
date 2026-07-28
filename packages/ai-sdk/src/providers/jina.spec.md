Jina provider — embeddings and reranking via raw `fetch` against `api.jina.ai`; no text generation (`create()` throws).

## TLDR

- `JinaProvider` (name `'jina'`): `createEmbedding()` / `createReranking()`; no SDK dependency at all.
- Rerank: POST `/v1/rerank` (`topK` → `top_n`); result `document` handles both string and `{text}` response shapes, falling back to the input document by index.
- Embed: POST `/v1/embeddings`; response `data` is sorted by `index` before extracting embeddings; usage from `prompt_tokens`/`total_tokens`.
