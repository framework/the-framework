The authoring surface of `@gemstack/mcp`: the base classes, decorators, DI resolver, validation, and the in-process test client (the transport/runtime half lives in `runtime/`, OAuth in `auth/`).

## TLDR

- `McpServer.ts` — server base class: holds the registered tool/resource/prompt classes, decorator metadata, the DI resolver, and notification fan-out to attached sessions (per-target errors are swallowed — disconnects are normal).
- `McpTool.ts` / `McpResource.ts` / `McpPrompt.ts` — the three primitives. Names default to the kebab-cased class name (minus a `Tool`/`Prompt` suffix); resources are keyed by URI, and a URI containing `{` makes it a template.
- `decorators.ts` — all metadata decorators (see `decorators.spec.md` for the one hard-won lesson in there).
- `resolver.ts` — the DI seam: instance-scoped (never global), one-function adapter for any container; with a `has()` hook a construction failure is loud, without it a miss silently falls back to `new Ctor()`.
- `validate-input.ts` + `zod-to-json-schema.ts` — call-time input validation (a security fix: the SDK validates only the envelope) and Zod 4 native JSON-Schema conversion (input mode, dates → date-time strings, fallback `{type:'object'}` so a tool always advertises *some* shape).
- `uri-template.ts` — the URI template matcher shared with inspector tooling; hardened against `%2F` path smuggling (the segment guard re-applies *after* percent-decoding), malformed escapes, and unescaped regex metacharacters in literals.
- `testing.ts` — `McpTestClient`: same validation path as production; imports runtime internals directly so tests never load the MCP SDK.
- `McpResponse.ts`, `observers.ts`, `types.ts`, `utils.ts`, `index.ts`, `runtime.ts` — response helpers, observer registry (a `globalThis` singleton so Vite SSR re-evaluation cannot fork it), types and barrels.

## Facts

- The main entry (`index.ts`) claims to keep the MCP SDK off the boot path, but `createMcpHttpHandler` statically reaches `runtime/sdk-server.ts` and therefore the SDK — only the streamable-HTTP transport class is truly lazy.
- `McpTestClient` asymmetries vs the real runtime: resource reads do exact-URI match only (no templates) and skip DI; prompt gets skip validation and DI. `@Handle` injection is only exercised for tools in tests.
- A former mounting API (`Mcp.web()` / `Mcp.local()` + a global server registry) was removed as dead code: docs presented it as *the* API, so readers registered into a map nothing read. The real handlers take a server **instance**.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
