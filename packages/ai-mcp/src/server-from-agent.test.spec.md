Tests for `server-from-agent.ts` (default `'tools'` mode) — covers exposing a fixture agent's tools over a real in-memory MCP session and forwarding calls to their execute fns.

## TLDR

- Loopback: `mcpServerFromAgent(FixtureAgent)` connected to a real SDK `Client` via `InMemoryTransport.createLinkedPair()`.
- Covers: each agent tool listed as an MCP tool, call forwarding (`greet` → string), a synchronously-returning execute fn (regression for the v0.1.3 `instanceof Promise` mis-detection — bare returns are legal for `.server()`), structured results stringified as JSON (`add` → `"sum": 5`), and `name`/`version` overrides.

## Facts

- Encodes the SDK gotcha: with zero registered tools the `tools` capability isn't advertised and `listTools` errors "Method not found", so the empty-agent case is deliberately untested here — `expose: 'agent'` (covered in `server-from-agent-modes.test.ts`) is the supported shape.
- Tools-mode tests never invoke a model; `void AiFake` / `void AiRegistry` just silence unused imports.
