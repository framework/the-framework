Tests for `defineConnector.ts` + `mountConnectors.ts` — covers validation, namespacing, result normalization, credential threading, annotations, instructions aggregation, and real transport mounting.

## TLDR

- Uses an in-memory `notes` connector fixture, driven through `McpTestClient` from `@gemstack/mcp/testing`.
- `defineConnector`: default filling; rejection of bad ids, empty tools, duplicate tool names.
- `mountConnectors`: `notes_*` prefix namespacing vs `namespace: 'none'` verbatim names; cross-connector collision throws under `'none'`; array/string handler returns normalize to text results; `credentials(id)` result lands in `ctx.auth` with the right `connectorId`; `readOnly` annotation surfaces to clients as `readOnlyHint`; `McpResponse.error(...)` surfaces as `isError: true` with `Error: <msg>` text.
- Instructions: per-connector text aggregates under `## <name>` headings, server-level text goes first, and `instructions` is `undefined` when nobody sets any.
- Transport reality checks (#976): a mounted server serves a full MCP session over `createWebRequestHandler` (initialize → `mcp-session-id` header → `tools/list` → `tools/call`), and `createMcpHttpHandler` accepts the instance — pinning that handler factories take an *instance*, not the class, so doc snippets can't drift from the API again.

## Facts

- `import 'reflect-metadata'` is required at the top — the annotation decorators depend on it.
- The `rpc()` helper parses both response framings the handler may return: plain JSON or SSE (`data:` line), each carrying one JSON-RPC payload.
