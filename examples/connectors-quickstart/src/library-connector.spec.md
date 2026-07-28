The reference connector: a read-only `defineConnector` over an in-memory book list, written to be copied as the starting point for a real `@gemstack/mcp-connectors` connector.

## TLDR

- id `library`, `auth: { type: 'none' }` — a real connector declares `pat`/`oauth` and reads the orchestrator-resolved token via `ctx.auth.token`; the in-memory `BOOKS` array stands in for the external API.
- Three zod-schema'd tools, all annotated `readOnly` + `openWorld`: `list-books`, `search-books` (case-insensitive title substring), `get-book` (returns an `{ error }` object for an unknown id rather than throwing).
