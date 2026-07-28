Source of `@gemstack/mcp-connectors`: the connector contract (types), its validator, and the composer that turns connectors into one MCP server.

## TLDR

- `types.ts` — the contract: `ConnectorAuth` (none/pat/oauth), `Credential`, `ConnectorContext`, `ConnectorTool`, `ConnectorDefinition`, `Connector`.
- `defineConnector.ts` — validates a definition (id/tool-name charset, unique names, handle + schema present) and fills defaults.
- `mountConnectors.ts` — composes connectors into a `McpServer` subclass: namespacing, per-call credential resolution, result normalization, annotation decorators, instructions aggregation.
- `index.ts` — barrel; also re-exports `McpResponse`/`McpToolResult` from `@gemstack/mcp` for connector error signaling.
- `index.test.ts` — full suite incl. driving a mounted server through real HTTP/web transport handlers.

## Facts

- Tool naming invariant: connector ids and tool names both match `/^[a-z][a-z0-9-]*$/`, and the default mount exposes `<connectorId>_<toolName>` (e.g. `notes_list`); `namespace: 'none'` shifts collision-avoidance to the caller and duplicates throw at mount time.
- Credentials flow: `mountConnectors({ credentials })` → called with the connector id before every tool call → `ctx.auth` in `handle(input, ctx)`; connectors never read env vars themselves.
