Runtime layer wiring the SDK-free core onto `@modelcontextprotocol/sdk` and its transports (stdio, streamable HTTP), plus the DI/streaming plumbing shared with the test client.

## TLDR

- `sdk-server.ts` — `createSdkServer` (registers all MCP request handlers on an SDK `Server`) + `startStdio`.
- `web-handler.ts` — Web `Request → Response` handler with full session lifecycle (stateful sessions, idle expiry, stateless pair-per-request, `close()`).
- `node-handler.ts` — `node:http` `(req, res)` bridge over the web handler (streams SSE bodies).
- `handle-deps.ts` — `resolveOrConstruct`, `resolveHandleDeps` (`@Handle` DI), `isRegistered`/`filterRegistered` (shouldRegister).
- `consume-tool-return.ts` — plain-promise vs async-generator tool returns; progress → `notifications/progress`.
- `observers-accessor.ts` — lazy `globalThis` reader for the observer registry.
- `web-handler.test.ts` (session lifecycle, #970) and `handle-deps.test.ts` (resolver fallback matrix).

## Facts

- Only `sdk-server.ts` and `web-handler.ts` import the SDK (the web transport class is dynamically imported); `handle-deps.ts` and `consume-tool-return.ts` are cheap siblings that `testing.ts` imports directly to avoid pulling the SDK.
- External consumers import through the `../runtime.ts` barrel; each sibling owns exactly one concern, so imports stay stable while internals move.
