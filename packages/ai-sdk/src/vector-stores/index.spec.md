`VectorStores` static facade + `VectorStore` wrapper for hosted vector-store CRUD, dispatched through `AiRegistry.resolveVectorStores()` (#B8 Phase 1).

## TLDR

- `VectorStores.create/list/get/delete` — resolve a provider (explicit `opts.provider`, else the provider segment of `AiRegistry.getDefault()` via `parseModelString`), then delegate to that provider's `VectorStoreAdapter`.
- `VectorStore` instances pin `{ provider, id }` so per-store ops don't repeat them: `add()` (existing provider `fileId` OR local `filePath`/`fileBuffer` uploaded via the Files API first; waits for `status === 'completed'` unless `wait: false`), `remove()`, `files()`, `delete()`.

## Facts

- Only OpenAI implements `createVectorStores()` today; other providers throw a helpful error pointing at `similaritySearch()` over local pgvector.
- Deleting a store or removing a file leaves the underlying file in the provider's Files API — clean up separately via `AI.files(provider).delete(id)`.
- `list()` exposes the provider's raw pagination cursor (`limit`/`after`/`before`); a complete listing requires manual iteration.
- Roadmap encoded in comments: B8 Phase 2 = the `fileSearch({ stores })` agent tool consuming these stores (now in `src/file-search.ts`); Phase 3 = local pgvector fallback.
