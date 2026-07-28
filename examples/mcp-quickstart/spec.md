Private workspace package `@gemstack/example-mcp-quickstart`: a runnable, framework-neutral MCP server built with `@gemstack/mcp` and zero `@rudderjs/*` packages — proving the "agent-agnostic, standalone" claim with OAuth 2.1 protection over both raw `node:http` and Hono.

## TLDR

- `src/` — server definition, the two transport mounts, and the SDK-client smoke test.
- `package.json` — `start:node` / `start:hono` entries (`tsx`), `test` (compile to `dist-test` + `node --test`); Hono + `@modelcontextprotocol/sdk` are devDependencies (test/demo only).
- `README.md` — file-by-file map and instructions to drive it with any MCP client (`Authorization: Bearer demo-token`).
