Private workspace package `@gemstack/example-connectors-quickstart`: a runnable reference connector for `@gemstack/mcp-connectors` — copy `src/library-connector.ts`, swap the in-memory data for a real API, and change `auth` to `pat`/`oauth` to write a real one.

## TLDR

- `src/` — the reference connector, demo runner, and smoke test.
- `package.json` — `start` (`tsx src/demo.ts`), `test` (compile to `dist-test` + `node --test`); depends on `@gemstack/mcp-connectors`, `@gemstack/mcp`, `reflect-metadata`, `zod`.
- `README.md` — what the example shows: `defineConnector`, `mountConnectors` with the credential seam, `McpTestClient` driving.
