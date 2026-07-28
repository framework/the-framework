Implements `mountConnectors()` — composes any number of `Connector`s into a single `@gemstack/mcp` `McpServer` *class* whose tools are the connectors' tools.

## TLDR

- Builds one dynamic `McpTool` subclass per connector tool (`makeToolClass`) and returns an anonymous `ConnectorsServer extends McpServer` carrying them plus `metadata()` (`name` default `'connectors'`, `version` default `'1.0.0'`, composed `instructions`).
- Tool names are namespaced `<connectorId>_<toolName>` by default (`namespace: 'prefix'`); `'none'` keeps names verbatim; any resulting duplicate throws at mount time.
- Credentials are resolved lazily per call: `options.credentials?.(connectorId)` runs before each `handle()`, producing `ctx = { connectorId, auth }` (`{}` when none) — the seam an orchestrator implements to satisfy each connector's declared `auth`.
- `normalizeResult()` wraps handler returns: an object with a `content` array passes through as `McpToolResult`; a `string` → `McpResponse.text`; anything else → `McpResponse.json`.
- Annotations map to @gemstack/mcp class decorators (`IsReadOnly`/`IsDestructive`/`IsIdempotent`/`IsOpenWorld`), applied as plain function calls on the generated class; `outputSchema` is attached to the prototype only when defined.
- The returned class plugs into the standard @gemstack/mcp surface: `createMcpHttpHandler(new Server())`, `createWebRequestHandler(new Server())`, `startStdio(new Server())`, or `McpTestClient` in tests.

## Decisions

- Returns a class, not an instance, to match the `@gemstack/mcp` server contract (`protected tools` + `metadata()` overrides); transport handlers then take an *instance* — the JSDoc example exists because older docs showed a dead `Mcp.web(path, Class)` registry API that never worked (#976 / changeset `9258b84`).
- `composeInstructions()` aggregates server-level text first, then each connector's `instructions` under a `## <connector name>` heading so the agent knows which tools each block applies to; previously per-connector instructions were silently dropped (changeset `a037b8c`). Returns `undefined` when nothing is set.
- Credential lookup happens at tool-call time (not at mount) so tokens can rotate / be per-request (e.g. a verified OAuth bearer from middleware).

## Flows

- mount: `mountConnectors(connectors, options) → per connector×tool: namespace name → collision check → makeToolClass() (+ annotation decorators, optional outputSchema) → return class ConnectorsServer extends McpServer { tools, metadata() }`
- tool call: `MCP tools/call → ConnectorToolImpl.handle(input) → await options.credentials?.(connector.id) → tool.handle(input, {connectorId, auth}) → normalizeResult() → McpToolResult`
