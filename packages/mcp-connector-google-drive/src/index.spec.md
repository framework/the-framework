The Google Drive connector definition (default export): nine tools to browse, read, and share Drive files over the Drive REST API v3.

## TLDR

- `defineConnector({ id: 'google-drive', auth: { type: 'oauth', scopes: ['https://www.googleapis.com/auth/drive'] }, ... })` — mounted tool names are `google-drive_<tool>`.
- Read tools (`readOnly` + `openWorld`): `get-about`, `list-files`, `search-files`, `get-file`, `get-file-content`, `list-permissions`.
- Write tools (`openWorld`): `create-folder`, `share-file`; `trash-file` is additionally `destructive` (even though trashing is reversible).
- Responses slimmed via `slimFile` to `FILE_FIELDS` (`id,name,mimeType,size,modifiedTime,owners(emailAddress),webViewLink`) plus derived `isFolder`; Drive returns `size` as a string, so it's `Number()`-coerced.
- Re-exports `GoogleDriveError` from `./client.js`.

## Decisions

- Auth is OAuth-only because Drive has no static API key; the orchestrator supplies the bearer via the mount `credentials` seam (same as every connector). `drive.readonly` suffices for the read tools.
- Expected failures return `McpResponse.error(...)` (→ `isError: true`) *before* any API call where possible: `get-file-content` on a folder, unexportable google-apps mime, `share-file` missing `emailAddress` (for `user`/`group`) or `domain` (for `domain` type).
- `list-files` excludes trashed files by default (`trashed = false` clause) unless `includeTrashed`; a caller-supplied raw `query` is parenthesized and ANDed with the generated clauses.

## Facts

- `driveStr()` escapes `\` then `'` for interpolation inside single-quoted Drive query literals (query-injection safety for `folderId` and search text).
- `get-file-content` fetches metadata first, then branches on mime: Google editor types export via `/files/<id>/export?mimeType=...` (`document`→`text/plain`, `spreadsheet`→`text/csv`, `presentation`→`text/plain`); other `application/vnd.google-apps.*` mimes are refused; everything else downloads via `/files/<id>?alt=media`.
- Folder mime is `application/vnd.google-apps.folder`; `create-folder` POSTs that mimeType with optional `parents: [parentId]`.
- Listing order is `modifiedTime desc`; `limit` maps to `pageSize` (defaults 30 list / 20 search, schema max 100); every request constrains `fields` to keep payloads small.
- `share-file` defaults `role: 'reader'`, `type: 'user'`; `trash-file` is a PATCH of `{ trashed: true }`, not a delete.
