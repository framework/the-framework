OpenAI hosted vector-stores adapter (#B8 Phase 1) — wraps `client.vectorStores.*` and `client.vectorStores.files.*` with file upload routing and ingestion polling.

## TLDR

- Store CRUD: `create` (forwards `metadata`/`expires_after`), `list` (limit/after/before), `get`, `delete` (`vectorStores.del`).
- `addFile`: resolve the file id — existing `{fileId}` skips upload, `{filePath}` streams via `files.create({purpose:'assistants'})`, `{fileBuffer}` goes through `openai/uploads` `toFile()` — then `vectorStores.files.create(storeId, {file_id, attributes?, chunking_strategy?})`, then poll `files.retrieve` until `completed`/`failed`/`cancelled` or timeout; `wait: false` returns the initial state immediately.
- Mappers: `fromOpenAIVectorStore` (fileCount from `file_counts.total`, else summed per-status counts) and `fromOpenAIVectorStoreFile` (status guarded to the known union, `last_error.message` → `lastError`).

## Decisions

- Default poll budget is 1s interval / 120s timeout — enough for typical PDFs but small enough that runaway batch uploads surface a clear error fast (message suggests raising `pollTimeout` or `wait: false`).
- Attributes and chunking config are passed as siblings of `file_id` on attach (OpenAI splits them from the file payload).

## Facts

- Unknown file statuses coerce to `'in_progress'` so polling keeps going rather than mis-terminating.
