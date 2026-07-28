Gemini Files API adapter (upload/list/delete) over `@google/genai`; the optional `FileAdapter.retrieve` is not implemented.

## Facts

- Upload sends a `Blob` with `displayName` = local basename; the returned id is `response.name ?? response.uri`; `bytes` comes from the local `stat()` (upload) or string-encoded `sizeBytes` (list).
- `list()` tolerates both response shapes (`response.files` or the response itself as an iterable/array).
- `delete` takes `{name: fileId}` (Gemini resource-name style), unlike OpenAI's positional id.
