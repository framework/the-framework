In-process test client (`McpTestClient`) exercising a server's tools, resources, and prompts directly — no transport and no MCP SDK involved.

## TLDR

- Constructor takes the server CLASS (not an instance) plus an optional `resolver`; it constructs the server with the resolver and instantiates every primitive via `resolveOrConstruct`.
- `callTool(name, input, onProgress?)`: validates input exactly as the runtime does (a test cannot pass arguments a real client would be rejected for), resolves `@Handle` deps, and consumes streaming returns; `onProgress` receives each yield, otherwise yields are dropped.
- `listTools/listResources/listPrompts` apply `filterRegistered` and attach decorator annotations; `readResource`/`getPrompt` enforce `isRegistered` (anti-bypass); `assert{Tool,Resource,Prompt}{Exists,Count}` helpers throw descriptive errors.

## Decisions

- Imports `handle-deps` and `consume-tool-return` directly from the runtime siblings, not the `runtime.ts` barrel, so the test client does not pull `@modelcontextprotocol/sdk`.
- Progress capture works by faking the SDK plumbing: a synthetic `progressToken: 'test'` plus a `sendNotification` shim that strips the token and forwards the rest to `onProgress` — so `consumeToolReturn` behaves exactly as in production.

## Facts

- `readResource` matches exact URIs only — no template matching, unlike `sdk-server`'s `resources/read`.
- Only `callTool` validates input and resolves `@Handle` deps; `readResource()` and `getPrompt()` call `handle()` bare (no params, no deps, no argument validation).
