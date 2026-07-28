OpenAI Files API adapter (upload/list/delete/retrieve) via the SDK.

## Facts

- Upload streams from disk via `node:fs` `createReadStream` (dynamic import); `purpose` defaults to `'assistants'`.
- Delete calls the SDK's `files.del(fileId)`; `retrieve` returns a Buffer with generic `mimeType: 'application/octet-stream'`.
- `list()` consumes the SDK's async-iterable pager (`for await`).
