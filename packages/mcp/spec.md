`@gemstack/mcp` — agent-agnostic framework for authoring MCP servers in TypeScript: tools/resources/prompts as classes, decorators, instance-scoped DI, OAuth 2.1, framework-neutral HTTP/stdio serving, and an in-process test client.

## TLDR

- `src/` — all sources: core abstract classes, decorators, DI seam, `runtime/` (SDK wiring + handlers), `auth/` (OAuth 2.1), observers, helpers, `McpTestClient`.
- `package.json` — ESM-only, Node >= 22.12; runtime deps are exactly `@modelcontextprotocol/sdk` ^1.29, `zod` ^4, `reflect-metadata`; subpath exports `.`, `./observers`, `./runtime`, `./testing`; tests compile via `tsconfig.test.json` into `dist-test/` and run with bare `node --test` (no test framework).
- `README.md` — positioning (server authoring, vs `@gemstack/ai-mcp` which bridges agents ⇄ MCP), quick start, `@Handle` DI, OAuth 2.1 wiring (middleware + metadata endpoint are BOTH required), `trustProxy`, testing, observers.
- `CHANGELOG.md` — detailed release history; prime source for the security decisions baked into 0.4.0.

## Facts

- Graduated from the mature `@rudderjs/mcp`, re-versioned under GemStack; `@rudderjs/mcp` becomes a thin binding over this core. `reflect-metadata` must be imported once at the consumer's entry point.
- 0.5.0 removed the dead `Mcp.web()/Mcp.local()` registry: it was write-only (nothing ever read the `__gemstack_mcp_servers__` store) yet documented as the mounting API. The real mounts take a server *instance*: `createMcpHttpHandler(server)`, `createWebRequestHandler(server)`, `startStdio(server)`.
- 0.4.0 was a security wave: only-`initialize`-opens-a-session + session expiry/close (#970), forwarded-header trust + RFC 7235 quoted-string escaping in OAuth, schema validation of tool/prompt arguments (injection surface), and `matchUriTemplate` traversal/regex fixes (#968).
- Runnable framework-neutral example: `examples/mcp-quickstart` (node:http + Hono, zero framework deps).
