`@gemstack/mcp-connectors` — the connector contract for GemStack AI orchestration: define a tool connector to an external service once (`defineConnector`), compose any number into a single `@gemstack/mcp` MCP server (`mountConnectors`).

## TLDR

- `src/` — the whole implementation: contract types, `defineConnector`, `mountConnectors`, tests.
- `package.json` — v0.2.2, single `.` export from `dist/`; depends on `@gemstack/mcp` + `reflect-metadata` (decorators); `zod` is a devDep only (consumers bring their own — schemas are accepted via the `ZodLikeObject` type, v3 or v4).
- `README.md` — the declare-vs-resolve auth philosophy, mount snippets for all transports, auth-type table, testing via `McpTestClient`; points to `examples/connectors-quickstart` as a copyable reference connector.
- `CHANGELOG.md` — notable history: `McpResponse.error` for user-facing failures (`e8d730f`), instructions aggregation (`a037b8c`), rename from `@gemstack/connectors` (`e51bd7d`), dead `Mcp.web()` registry removal + docs fix (`9258b84`).
- `tsconfig*.json` — typecheck / build / compile-tests configs; `npm test` = compile to `dist-test` then `node --test`.

## Decisions

- Central architecture rule: a connector *declares* its auth requirement and tools; the mounting orchestrator *resolves* credentials (per call) and picks the transport. That split is what lets first-party and third-party connectors compose interchangeably.
- Renamed from `@gemstack/connectors` to sit in the visible `mcp-` family and establish `mcp-connector-<x>` as the convention third parties mirror (e.g. `@acme/mcp-connector-stripe`); old npm names are deprecated.
- Expected, user-facing failures should be returned as `McpResponse.error(...)` (→ `isError: true`) rather than thrown or returned as `{ error }` data — throwing is reserved for unexpected faults.
