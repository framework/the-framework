Minimal Google Drive REST (v3) client over global `fetch` — `gd()` for JSON calls, `gdText()` for raw-text downloads — plus the `GoogleDriveError` class; no Google SDK dependency.

## TLDR

- `gd(ctx, method, path, body?)` calls `https://www.googleapis.com/drive/v3${path}` with `Authorization: Bearer <ctx.auth.token>` (a Google OAuth 2.0 access token); JSON in/out; `204` → `undefined`.
- `gdText(ctx, path)` GETs raw bytes as text — used for `alt=media` downloads and Docs `/export` responses.
- Missing token → `GoogleDriveError(401)` with an actionable message (provide an OAuth bearer via mount `credentials`); non-2xx → `GoogleDriveError(status, "<METHOD> <path> -> <status> <statusText>: <body>")`.

## Facts

- A `fetch()` transport failure (DNS, timeout, offline) is rethrown as `GoogleDriveError` with `status: 0` instead of a raw `TypeError` (changeset `eaa667c`), so all failures surface through one typed class.
