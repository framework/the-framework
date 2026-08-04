OAuth 2.1 protection for `@gemstack/mcp` servers: resource-server verification only, with bring-your-own token verification.

## TLDR

- `oauth2McpMiddleware(mcpPath, opts)` enforces Bearer tokens on the MCP endpoint: your `verifyToken` decides validity; claims land on `req.mcpAuth`; 401 `invalid_token` vs 403 `insufficient_scope`; wildcard scope `'*'` grants all.
- `registerOAuth2Metadata(...)` serves the RFC 9728 protected-resource metadata — **both** halves are required, because the challenge points clients at the metadata URL only the registrar serves.
- Deliberately not an authorization server: no token issuance, no identity-provider opinions.

## Facts

- `X-Forwarded-Host`/`-Proto` are ignored unless `trustProxy: true` — the forwarded value becomes the metadata URL clients follow to authenticate, so honoring it blindly lets a client redirect another client's auth discovery or downgrade it to http. Only the first (client-facing) value is read, and anything not shaped like a bare `host[:port]` is discarded.
- The `WWW-Authenticate` header escapes `\` before `"` — the reverse order lets a value ending in a backslash escape the closing quote and inject extra auth params.
- A throwing `verifyToken`'s message is surfaced verbatim in the challenge; returning `null` yields the generic message.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
