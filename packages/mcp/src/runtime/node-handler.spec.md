Framework-neutral `node:http` `(req, res)` handler for an MCP server — a bridge from Node's `IncomingMessage`/`ServerResponse` to the Web-standard handler.

## TLDR

- `createMcpHttpHandler(server, options?)` wraps `createWebRequestHandler`: converts the Node request to a Web `Request`, calls the web handler, then streams the `Response` back.
- Request conversion: URL rebuilt from the `Host` header (fallback `localhost`) + first `x-forwarded-proto` value (fallback `http`); multi-value headers appended; body buffered for non-GET/HEAD methods (omitted when empty).
- Response writing streams the body reader chunk-by-chunk into `res.write`, so SSE notification channels stay open instead of being buffered.
- Uncaught errors → 500 `{ error: 'internal_error', message }` (only writes the head if headers not already sent).
- `handler.close()` delegates to the web handler: tears down every live session and refuses further requests; idempotent.

## Facts

- Mounts anywhere a `(req, res)` handler fits — raw `http.createServer`, Express, Connect — with no framework dependency; this is the handler exported from the main package entry.
