The framework-neutral quickstart MCP server: one tool, one resource, one prompt, dependency injection without a container, and an OAuth `verifyToken` — zero `@rudderjs/*` packages.

## TLDR

- `Greeter` is a plain service; `GreetTool`'s `@Handle(Greeter)` injects it (resolved from the server's resolver) after the zod-validated input — the token is explicit, so no decorator metadata is needed.
- `VersionResource` (uri `info://version`) and `GreetingPrompt` (zod-typed arguments) round out the three primitive kinds; `QuickstartServer` declares them as class lists under `@Name`/`@Version`/`@Instructions`.
- `makeServer()` wires an INSTANCE-SCOPED resolver — passed at construction, never read off a global; `createResolver()` needs no DI container (adapt Awilix/tsyringe by implementing `McpResolver = { resolve(token) }`).
- OAuth 2.1: the core is auth-agnostic — the example's `verifyToken` accepts the single `DEMO_TOKEN` (`'demo-token'`) and grants `{ sub: 'demo-user', scopes: ['mcp.read'] }`; production should validate the JWT and return real claims, or null/throw. `REQUIRED_SCOPES = ['mcp.read']`.
