Google Gemini provider suite over `@google/genai`, split one file per capability and assembled by `provider.ts`.

## TLDR

- `provider.ts` — `GoogleProvider` factory (name `'google'`); only `create()` (chat) receives the optional `GoogleCacheRegistry`.
- `chat.ts` — generate/stream adapter with explicit-cache resolve + stale-404 retry, native `google_search`/`fileSearch` blocks, functionCall/functionResponse conversion.
- `embeddings.ts` — parallel `embedContent` calls (zero usage reporting).
- `images.ts` — Imagen via raw REST `:predict` (bypasses the SDK).
- `files.ts` — Files API upload/list/delete (no `retrieve`).
- `vector-store.ts` — FileSearchStores hosted RAG with LRO polling and CustomMetadata attribute mapping (#B8.5).
- `filters.ts` — typed `FileSearchFilter` → Gemini `metadataFilter` string translator.
- `client.ts` / `config.ts` — lazy `GoogleGenAI` construction / `GoogleConfig` type.
- `index.ts` — public barrel (re-exported by the legacy `../google.ts` path).

## Facts

- The cache registry itself lives one level up (`../google-cache-registry.ts`) because it's provider-infrastructure shared with the AiProvider bootstrap, not a capability adapter.
- FileSearchStores and its filter syntax are Gemini-API-only — not available on Vertex AI.
