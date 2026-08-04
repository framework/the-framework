`@gemstack/mcp` — an agent-agnostic framework for authoring MCP servers with a class-based, decorator-driven API on top of the official `@modelcontextprotocol/sdk`.

## TLDR

- You author `McpTool` / `McpResource` / `McpPrompt` subclasses, register their **classes** (not instances) on an `McpServer` subclass, and the runtime turns that into a working MCP server.
- Three transports for the same server: stdio (`startStdio`), a Web-standard `(Request) => Response` handler, and a Node `(req, res)` handler — CLI, edge runtime, or Express, unchanged.
- Input is declared with Zod, converted to JSON Schema for advertising, and **validated at call time** (the low-level SDK only validates the protocol envelope, not tool input).
- Optional dependency injection: a one-function resolver adapter (`{ resolve(token) }`) wires any DI container into tool `handle(input, ...deps)` methods.
- OAuth 2.1 protection is bring-your-own-`verifyToken` middleware plus an RFC 9728 metadata registrar — the package never verifies tokens itself and never plays authorization server.
- `McpTestClient` drives a server fully in-process (validation, DI, result consumption) with no transport.

## Decisions

- **This is the server-authoring axis of MCP, not the agent axis.** It never depends on `@gemstack/ai-sdk` (a server can expose a database or the weather; no agent involved). Exposing an existing agent as MCP is the other package, `@gemstack/ai-mcp`.
- Registration by class, instantiation per session/request — so stateful web deployments get fresh tool instances per session and DI happens at resolution time.
- Error convention: tools return `isError: true` results (agents can read them); resources and prompts throw. `McpResponse.error()` signals *expected* user-facing failure; throwing is for unexpected faults.
- Streaming tool progress mirrors ai-sdk's pattern: a tool may return an async generator (yield progress, return result) instead of taking a `send` callback.

## Facts

- `ZodLikeObject` (`{ shape }`) is a structural type so tools authored against Zod v3 *or* v4 type-check without a package version bump; validation and schema conversion degrade gracefully for non-Zod values.
- `shouldRegister?()` on all three primitives is security-relevant: returning false hides the primitive from lists *and* blocks direct calls (no bypass-by-name).
- The richest "why" record in the package is its `CHANGELOG.md` (input-validation security fix, session-leak fix, URI-template hardening, the removed `Mcp.web()` registry API).

## Flows

- Authoring: subclass + decorate (`@Name`, `@Version`, `@Instructions`, annotations) → register classes on a server → pick a transport (or the test client).
- Tool call: find by name → `shouldRegister` gate → validate input (Zod) → resolve DI deps → `handle()` → normalize the return (value or generator) into an MCP result → notify observers.
- See `src/spec.md` for the file map and `src/runtime/spec.md` for the transport/session layer.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
