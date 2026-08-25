# Bug analysis: packages/framework/src/request-path.ts

## Business logic (high-level)

One defensive helper (#938): extract a pathname from an `IncomingMessage` without ever throwing, because Node hands the request target through verbatim and `new URL` throws synchronously on malformed targets — inside a request handler that would take the daemon down. `undefined` means "no parseable path"; the server answers 400 or serves its fallback. Matches `request-path.SPEC.md` exactly.

Probed the behavior matrix:

- `GET /x?y=z` → `'/x'` (search stripped — callers route on path only).
- Absolute-form proxy target `GET http://evil.example/x` → `'/x'` (a well-formed absolute URL *parses*; the base is ignored, the pathname is served — reasonable: the request is answerable, and the host part is irrelevant to routing).
- Malformed absolute-form `GET http://[` → throws inside `new URL` → caught → `undefined`. This is the crash class the module exists for.
- `OPTIONS *` → `'/*'` (no throw; the server's routing simply won't match — fine).
- Protocol-relative `//host/y` → `'/y'`; `req.url === undefined` (never in practice for server requests) → `'/'` via the `?? '/'`.

Edge cases: percent-encoding is left as-is (`/%2e%2e/` stays encoded — `URL.pathname` does not decode, so no traversal is introduced here; any decode happens, or not, in the file-serving layer, outside this module's scope). No state, no async, no resources.

## Functions (low-level)

- **`requestPathname(req)`** — try/catch around `new URL(req.url ?? '/', 'http://localhost')`, returns `.pathname` or `undefined`. The fixed base is only a parsing anchor; nothing user-controlled reaches it. Verdict: correct.

## Bugs found

None found.
