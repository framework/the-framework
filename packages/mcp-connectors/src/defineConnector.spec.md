Implements `defineConnector()` — validates a `ConnectorDefinition` and fills defaults, returning a `Connector` ready for `mountConnectors`.

## TLDR

- Rejects: non-object definition, invalid `id`, empty `tools`, invalid/duplicate tool names, a tool missing `handle()` or a Zod `schema`.
- Defaults filled: `name` = `id`, `version` = `'1.0.0'`, `auth` = `{ type: 'none' }`; `instructions` only included when set.

## Facts

- Connector ids and tool names share one charset, `/^[a-z][a-z0-9-]*$/`, so the mounted namespaced form `<connectorId>_<toolName>` stays MCP-safe.
