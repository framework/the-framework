Framework-agnostic OAuth 2.1 bearer-token middleware for MCP web endpoints, plus the RFC 9728 protected-resource metadata endpoint that its challenges point clients to.

## TLDR

- `oauth2McpMiddleware(mcpPath, options)`: Connect-style middleware — requires `Authorization: Bearer <jwt>`, verifies via the app-supplied `verifyToken`, checks required scopes, attaches `req.mcpAuth = { sub?, scopes?, claims }`, then calls `next()`.
- Every failure answers with an RFC 9728 `WWW-Authenticate: Bearer resource_metadata="…", error="…"` challenge: 401 `invalid_token` (missing/empty/invalid token, no verifier configured) or 403 `insufficient_scope` (with the required scopes in a `scope` param).
- `registerOAuth2Metadata(router, mcpPath, options)`: serves the metadata document (`resource`, `authorization_servers`, `bearer_methods_supported: ['header']`, optional `scopes_supported`) at `/.well-known/oauth-protected-resource${mcpPath}`. Both pieces must be wired — without the document, compliant clients cannot discover the authorization server.

## Problems

- The metadata URL in the challenge is exactly what a compliant client follows to authenticate. Deriving it from client-suppliable `X-Forwarded-Host`/`X-Forwarded-Proto` let anyone reaching the endpoint redirect other clients' discovery to an attacker host or downgrade the scheme to http (fixed in 0.4.0).
- RFC 7235 quoted-string injection: an unescaped `"` in the host or path broke out of `resource_metadata="…"` and injected extra `error`/`scope` auth-params ahead of the real ones.

## Decisions

- The core is auth-agnostic: `verifyToken` is user-supplied (jose, token introspection, framework auth). Returning `null` yields a generic "Invalid or expired token."; a thrown `Error`'s message is surfaced in the challenge (e.g. "Token has been revoked.").
- `trustProxy` is off by default; when on, only the first (client-facing) comma-separated value of each forwarded header is read, and a forwarded host must match `HOST_PATTERN` (bare `host[:port]`, incl. bracketed IPv6) or is discarded in favour of the real one.
- The wildcard scope `'*'` on the token bypasses the scope check entirely.
- An empty bearer token (`Bearer   `) is rejected up-front without ever calling the verifier (0.2.1).
- `escapeQuoted` replaces `\` before `"` — reversed order would let a value ending in `\` escape the closing quote.
- Request/response types (`OAuth2Request`/`OAuth2Response`) are minimal structural shapes so the middleware fits Express, Connect, or hand-rolled routers without importing any framework.

## Facts

- Host resolution chain: trusted `x-forwarded-host` → `req.host` → `Host` header → `req.hostname` → `'localhost'`; proto: trusted `x-forwarded-proto` → `req.protocol` → `'http'`.
- 403 is used only for `insufficient_scope`; all other failures are 401. Response body mirrors the challenge: `{ error, error_description, scope? }`.
- With no `verifyToken` configured every token gets 401 "OAuth provider not configured." — the endpoint fails closed.
- In the metadata document, `resource` defaults to `<origin><mcpPath>` and `authorization_servers` defaults to `[origin]` when not set in options.
