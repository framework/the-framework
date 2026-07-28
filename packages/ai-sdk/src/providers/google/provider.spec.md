`GoogleProvider` factory (name `'google'`) wiring `GoogleConfig` plus an optional `GoogleCacheRegistry` into the per-capability adapters.

## TLDR

- `create()` → `GoogleAdapter` (the only adapter that receives the cache registry), `createEmbedding()`, `createImage()`, `createFiles()`, `createVectorStores()`.
- The cache registry is injected at construction (by the host's provider bootstrap) — chat prompt caching is inert without it.
