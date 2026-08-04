`@gemstack/mcp-connectors` — the connector contract: how integrations with external services (GitHub, Google Drive, …) are declared once and composed into one MCP server.

## TLDR

- Two halves: `defineConnector` (a connector declares its name, its auth *requirement*, and its tools — and nothing else) and `mountConnectors` (an orchestrator supplies credentials, picks the transport, namespaces tool names, and returns one composed `@gemstack/mcp` server class).
- The **declare-needs / supply-later split is the whole point**: a connector never reads env vars, never runs an OAuth flow, never picks a transport. That is what makes first-party and third-party `mcp-connector-*` packages interchangeable and keeps secret handling in exactly one place.
- Sits on the MCP server axis, not the AI axis: depends on `@gemstack/mcp`, never on `ai-sdk`.

## Decisions

- Tool names are namespaced at mount time (`<connector-id>_<tool>`, default) by the orchestrator, not the author — two connectors can never collide, and consumers see one uniform scheme. A collision under `namespace: 'none'` throws at mount with the fix in the message.
- Credentials are resolved **per tool call**, not at mount, so token rotation and per-request bearers work without remounting.
- Definition-time validation fails fast with `defineConnector("<id>")`-prefixed messages: bad id (`^[a-z][a-z0-9-]*$`, also enforced on tool names so namespaced names stay MCP-safe), empty/duplicate tools, missing `handle` or `schema`.
- A connector's `auth.env` name is documentation for the orchestrator — `mountConnectors` itself never touches `process.env`.

## Facts

- Annotations are applied by calling the `@gemstack/mcp` decorators as plain functions on generated tool classes; only truthy flags are applied.
- The result of `mountConnectors` is an ordinary `McpServer` class, so every transport handler and `McpTestClient` work unchanged.
- Per-connector instructions are composed under `## <Connector name>` headings so an agent knows which tools each instruction block applies to.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
