`@gemstack/mcp-connector-google-drive` — Google Drive connector for GemStack AI orchestration: browse, read, and share Drive files over the Drive REST API v3, built on `@gemstack/mcp-connectors`.

## TLDR

- `src/` — the connector definition (9 tools), the minimal fetch-based Drive client, and the test suite.
- `package.json` — v0.2.2, single `.` export from `dist/`; depends on `@gemstack/mcp-connectors`, `@gemstack/mcp`, `zod`; no Google SDK.
- `README.md` — mount snippet, auth notes (Drive is OAuth 2.0-only — no static API key; declared scope `https://www.googleapis.com/auth/drive`, `drive.readonly` suffices for reads), and the tool table (6 read / 2 write / 1 destructive).
- `CHANGELOG.md` — second connector on the contract (epic #86); later: validation failures → MCP errors, transport failures → `GoogleDriveError(status 0)`, rename from `@gemstack/connector-google-drive`.
- `tsconfig*.json` — typecheck / build / compile-tests; `npm test` = compile then `node --test` in `dist-test`.

## Facts

- Read tools carry the `readOnly` annotation so an agent can auto-approve them; `trash-file` is marked `destructive` despite being reversible. Responses are slimmed to agent-relevant fields to keep token usage down.
