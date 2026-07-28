Hosted vector-store management (#B8 Phase 1), single module.

## TLDR

- `index.ts` — `VectorStores` facade + `VectorStore` wrapper over per-provider `VectorStoreAdapter`s (OpenAI-only today); consumed by the `fileSearch` agent tool (`src/file-search.ts`, B8 Phase 2). Tests: `src/vector-stores.test.ts`, `src/google-vector-stores.test.ts`.
