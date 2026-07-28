Gemini embeddings adapter — one `models.embedContent` call per input, issued in parallel via `Promise.all`.

## Facts

- Usage is always reported as zeros (the embedContent response carries no token counts the adapter reads).
- Embeddings read from `r.embedding.values`, defaulting to `[]` per input.
