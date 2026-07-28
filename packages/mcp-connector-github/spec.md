`@gemstack/mcp-connector-github` — GitHub connector for GemStack AI orchestration: read and act on issues, PRs, and repo files over the GitHub REST API, built on `@gemstack/mcp-connectors`.

## TLDR

- `src/` — the connector definition (9 tools), the minimal fetch-based REST client, and the test suite.
- `package.json` — v0.2.2, single `.` export from `dist/`; depends on `@gemstack/mcp-connectors`, `@gemstack/mcp`, `zod`; no GitHub SDK.
- `README.md` — mount snippet, auth notes (PAT or OAuth bearer via mount `credentials`; declared `{ type: 'pat', env: 'GITHUB_TOKEN' }`), and the tool table (7 read / 2 write).
- `CHANGELOG.md` — first real connector on the contract (epic #86); later: validation failures → MCP errors, transport failures → `GitHubError(status 0)`, rename from `@gemstack/connector-github`.
- `tsconfig*.json` — typecheck / build / compile-tests; `npm test` = compile then `node --test` in `dist-test`.

## Facts

- Read tools carry the `readOnly` annotation so an agent can auto-approve them; writes do not. Responses are slimmed to agent-relevant fields to keep token usage down.
