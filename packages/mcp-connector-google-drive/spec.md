`@gemstack/mcp-connector-google-drive` — the first-party Google Drive connector: nine tools over Drive REST v3 (browse, search, read content, share), following the `@gemstack/mcp-connectors` contract.

## TLDR

- `auth: { type: 'oauth', scopes: [...] }` — Drive has no static API key, so it is bearer-token-only.
- Two client functions because Drive needs both JSON metadata calls and raw-body reads: Google-editor files (Docs/Sheets/Slides) must be **exported** (Docs → text, Sheets → CSV) while binary files are downloaded via `alt=media`; `get-file-content` branches on MIME type and errors clearly for folders and unexportable types.

## Facts

- Drive query injection is guarded by escaping `\` then `'` for single-quoted query literals; `list-files.query` is deliberately passed through raw as a documented power-user escape hatch.
- `share-file` validates cross-field requirements Zod alone cannot express (user/group need `emailAddress`, domain needs `domain`) and returns tool errors rather than throwing.
- `trash-file` is the only tool annotated `destructive` in either first-party connector — and it trashes (reversible), never deletes.
- Field masks (`FILE_FIELDS`) restrict what is *requested* from the API, not just what is returned.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
