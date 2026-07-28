Gemini FileSearchStores adapter (#B8.5) — Google's hosted-RAG equivalent of OpenAI vector stores: store CRUD plus document add/remove/list with long-running-operation polling.

## TLDR

- `GoogleVectorStoreAdapter`: `create`/`list`/`get`/`delete` over `client.fileSearchStores.*`; `addFile`/`removeFile`/`listFiles` over `fileSearchStores.documents.*` and ingestion ops.
- `addFile` paths: `{fileId}` → `importFile` (reuse a Files API file); `{filePath | fileBuffer}` → `uploadToFileSearchStore` (single-shot upload). Both return LROs; `finishVectorStoreOperation` polls `client.operations.get` until `done` (defaults: `wait: true`, interval 1s, timeout 120s; `wait: false` returns an `in_progress` stub).
- Exported mappers (`@internal`, unit-tested): `fromGeminiFileSearchStore`, `fromGeminiDocument`, `attributesToCustomMetadata`, `customMetadataToAttributes`, `mimeTypeFromFilename`.

## Problems

- The Gemini SDK can't infer a MIME type from an untyped `new Blob([data])` (`blob.type` is empty) — buffer uploads forward an explicit `mimeType` derived from the filename; unknown extensions return `''` and the field is dropped so the SDK's own error fires loudly instead of a silently wrong type.
- LRO terminal state is dual-shaped: `op.error {code,message}` → status `'failed'` + `lastError`; `op.response.documentName` → success, followed by a best-effort `documents.get` for real `createdAt`/`sizeBytes` (falls back to op data on a rare race); done-with-neither surfaces as `'completed'` without details.

## Decisions

- Store-level `metadata` and `expiresAfter` are unsupported by Gemini — `create()` throws fail-loud instead of silently dropping them (attributes go per-document; stores persist until deleted).
- `delete` always passes `force: true` to mirror OpenAI semantics — without it Gemini returns FAILED_PRECONDITION on a non-empty store.
- `before` pagination is silently dropped (Gemini only pages forward via `pageToken`; matches OpenAI when `before` is unset).
- Booleans in `attributes` are stored as `stringValue: 'true'|'false'` (CustomMetadata has no boolean variant) and round-tripped back to booleans on read; `stringListValue` entries are dropped on read (no flat-attribute representation).

## Facts

- `VectorStoreInfo.id` is the full resource name (`fileSearchStores/...`); document ids are `fileSearchStores/<store>/documents/<doc>` — `removeFile` joins the store prefix when given a bare document id.
- `fileCount` = `activeDocumentsCount + pendingDocumentsCount` (both string-encoded); `failedDocumentsCount` is dropped (surfaced per-file via addFile status instead). `bytesUsed`/`bytes` parse string-encoded `sizeBytes`.
- `DocumentState` mapping: `STATE_ACTIVE` → `completed`, `STATE_FAILED` → `failed`, `STATE_PENDING`/unknown → `in_progress`.
- `createdAt` is parsed from ISO 8601 `createTime` to Unix seconds for parity with OpenAI's `created_at`.
- NOT available on Vertex AI — the underlying SDK methods throw for Vertex clients.
- `VectorStoreInfo.name` is `displayName`, with `create()`'s user-supplied name as override so `create('Knowledge Base')` round-trips even when the API response omits it.
