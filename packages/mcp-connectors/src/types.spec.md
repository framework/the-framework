Type contract of the connector system: `ConnectorAuth`, `Credential`, `ConnectorContext`, `ConnectorTool(+Annotations/Return)`, `ConnectorDefinition`, `Connector`.

## TLDR

- `ConnectorAuth` — what credential a connector *declares* it needs: `{ type: 'none' }`, `{ type: 'pat', env?, description? }`, or `{ type: 'oauth', scopes?, authorizationServers?, description? }` (mirrors @gemstack/mcp's OAuth protect options).
- `Credential` — the resolved credential handed to tools at call time; `token` is the common case, index signature carries anything else.
- `ConnectorContext` — `{ connectorId, auth }` passed to every `handle()`.
- `ConnectorToolReturn` — a full `McpToolResult`, a `string` (wrapped as text), or any JSON value (wrapped as pretty JSON).
- `ConnectorToolAnnotations` — `readOnly`/`destructive`/`idempotent`/`openWorld` MCP-annotation hints; all-unset means read-write, non-destructive, non-idempotent.
- `ConnectorTool` — `name`, `description?`, Zod `schema` (v3 or v4 via `ZodLikeObject`), `outputSchema?`, `annotations?`, `handle(input, ctx)`.

## Decisions

- Core architectural split: a connector only *declares* its auth requirement; it never reads env vars or does OAuth itself — the mounting orchestrator resolves a `Credential` per call. This is what lets first- and third-party connectors compose interchangeably.
- `ConnectorDefinition.tools` is `ConnectorTool<any>[]` so each tool's `handle` may annotate its own input type; the Zod schema is the runtime source of truth.
- `Credential.token` is explicitly `string | undefined` so a provider can return `{ token: process.env.X }` directly under `exactOptionalPropertyTypes`.
