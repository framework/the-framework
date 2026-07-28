Source of the Google Drive connector: definition + REST client + tests.

## TLDR

- `index.ts` — the `defineConnector` default export: 9 `google-drive_*` tools (6 read-only, 2 write, 1 destructive) with Drive-query escaping, Docs/Sheets/Slides export handling, and slimmed responses; re-exports `GoogleDriveError`.
- `client.ts` — `gd()` JSON wrapper + `gdText()` raw-text wrapper (Bearer auth, typed `GoogleDriveError` incl. `status: 0` for transport failures).
- `index.test.ts` — mounted end-to-end suite over a fetch stub.
