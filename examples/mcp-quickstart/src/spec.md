Source of the MCP quickstart: one server definition served over two transports, plus the CI smoke.

## TLDR

- `server.ts` — the server: tool/resource/prompt classes, `@Handle` DI via `createResolver` (no container), OAuth `verifyToken` + `DEMO_TOKEN`.
- `node-http.ts` — raw `node:http` mount, OAuth 2.1-protected via a ~10-line `res` adapter.
- `hono.ts` — the same server on Hono through the Fetch-style handler (unprotected demo mount).
- `quickstart.test.ts` — real MCP SDK client round-trips: 401 without a token, authenticated `tools/call`, and the Hono mount.
