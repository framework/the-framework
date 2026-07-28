Source root of `@gemstack/mcp`: SDK-free core classes and helpers at this level, SDK/transport wiring under `runtime/`, OAuth under `auth/`.

## TLDR

- `McpServer.ts` / `McpTool.ts` / `McpResource.ts` / `McpPrompt.ts` — abstract base classes users extend; `McpResponse.ts` — tool-result factory.
- `decorators.ts` — reflect-metadata decorators: identity (`@Name`/`@Version`/`@Instructions`/`@Description`), `@Handle` DI tokens, MCP-spec tool/resource annotations.
- `resolver.ts` — DI seam: `McpResolver` interface + built-in `createResolver()`.
- `index.ts` — public entry; `runtime.ts` — barrel over `runtime/`; `types.ts` (`ZodLikeObject`), `utils.ts` (`toKebabCase`).
- `runtime/` — SDK server wiring, web/node HTTP handlers, DI + streaming plumbing.
- `auth/` — OAuth 2.1 middleware + RFC 9728 metadata endpoint.
- `observers.ts` — global tool/resource/prompt event registry (Telescope hook-in).
- `uri-template.ts` / `validate-input.ts` / `zod-to-json-schema.ts` — pure helpers (template matching, argument validation, schema advertising).
- `testing.ts` — in-process `McpTestClient`; `index.test.ts` + `uri-template.test.ts` — suites.

## Decisions

- Layering: everything at this level is `@modelcontextprotocol/sdk`-free; only `runtime/sdk-server.ts` and `runtime/web-handler.ts` touch the SDK. `testing.ts` imports the cheap runtime siblings directly (not the barrel) to stay SDK-free.
- DI is instance-scoped: a resolver is passed at server construction and threaded by the runtime to primitive construction and every `@Handle` site — never read off a global; failures are loud and `undefined` is never injected.
- All cross-module shared state uses process-global identities (`Symbol.for('gemstack.mcp.*')` metadata keys, `globalThis.__gemstack_mcp_observers__`) so bundle duplication and Vite SSR re-evaluation cannot fork it.

## Facts

- `shouldRegister?()` gating is enforced by every consumer in BOTH directions — hidden from listings and rejected on direct call/read/get (anti-bypass) — in `runtime/sdk-server.ts` and `testing.ts` alike.
- Tool/prompt input validation (`validate-input.ts`) runs identically in the SDK runtime and the test client, so tests cannot pass arguments a real client would be rejected for.
