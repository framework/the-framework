Serves the quickstart MCP server over raw `node:http`, protected by OAuth 2.1.

## TLDR

- `asOAuth2Res()` adapts node's `ServerResponse` to the Express-like `res` that the Connect-shaped `oauth2McpMiddleware` expects — this tiny adapter is the only glue needed to protect a raw `node:http` server (the same handler shape works on Express/Connect).
- `createNodeHandler()` chains `oauth2McpMiddleware('/mcp', { scopes: REQUIRED_SCOPES, scopesSupported, verifyToken })` before `createMcpHttpHandler(makeServer())`.
- Runnable entry when executed directly: listens on `PORT` (default 3000) at `/mcp`, Bearer token required.
