Mounts the same quickstart MCP server on Hono via the Fetch-style `createWebRequestHandler`, proving `@gemstack/mcp` is transport-agnostic — the handler is a `(Request) => Promise<Response>`, which Hono (and Vike, Bun, Deno, Cloudflare Workers) speak natively.

## Facts

- This mount is deliberately unprotected to stay short; to protect the Fetch path, read the `Authorization` header in a Hono middleware and call the same `verifyToken` from `server.ts` before delegating.
- Runnable directly on Node via `@hono/node-server` (`PORT` env, default 3000) when executed as the entry file.
