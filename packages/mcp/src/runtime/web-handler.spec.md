Framework-neutral MCP handler mapping a Web `Request` to a `Response` via the SDK's streamable-HTTP transport, owning the full session lifecycle (stateful and stateless).

## TLDR

- `createWebRequestHandler(server, options?)` is the engine behind `createMcpHttpHandler` and any Fetch-style binding (Hono, Vike, edge runtimes).
- Stateful (default): sessions keyed by the `mcp-session-id` header, ids from `sessionIdGenerator` (default `crypto.randomUUID`). Only an `initialize` POST may open a session; anything else without a live id is answered 400 (no header) / 404 (unknown id) without allocating. Idle sessions (default 30 min, `sessionIdleMs`) are swept on each request; `0`/`Infinity` disables expiry.
- Stateless (`sessionIdGenerator: undefined` passed explicitly): one transport+SDK pair per request, released when the response body ends (a wrapping `ReadableStream` releases on done/error/cancel so streaming replies aren't cut short).
- `connect()` builds the SDK via `createSdkServer`, connects the transport, calls `server.attachSdk`; on failure everything built so far is released. `discard()` is the single release point (detach + sdk.close + transport.close, close errors swallowed).
- `handler.close()`: marks closed (further requests → 503 JSON-RPC error), discards all stateful sessions and transient stateless pairs; idempotent.

## Problems

- #970: any POST without a session used to build and attach a transport+SDK pair that nothing ever detached — the server's notification set grew by one per unauthenticated request. Now only `initialize` allocates.
- A rejected initialize (bad Accept header, malformed params) registers no session, so nothing else would ever release the pair — after `handleRequest` the code checks `transport.sessionId` maps back to this session and discards otherwise.
- Sharing one stateless transport was racy and, since SDK 1.29, fatal (a reused stateless transport throws on request-id collisions) — hence strictly pair-per-request.
- Releasing a stateless pair on handler return would cut streaming replies short — release is tied to response-body completion instead.

## Decisions

- The transport class is lazily `await import`ed on first request (`transportCtor()` memoizes it).
- Expiry sweeping happens inline on each stateful request instead of a timer; the `now` clock hook (`@internal`) lets tests age sessions without waiting.
- `unknownSession` mirrors the transport's own error wire format (404/`-32001` "Session not found"; 400/`-32000` header-required) so clients see a single format.
- `opensSession` is a deliberately loose check (`method === 'initialize'`, including inside batch arrays) — the transport still validates the payload; this only decides whether a session may open.
- `onsessionclosed` deletes the map entry and calls `detach` through the `opened` closure variable, so the attached SDK is released without holding a stale reference.

## Facts

- The streamable-HTTP spec lets a server end a session at any time; clients re-initialize when they see the 404 — which is why idle expiry is safe.
- Session shape: `{ transport, sdk, detach, lastSeen }`; `lastSeen` is refreshed on every routed request.
- JSON-RPC error bodies use `id: null`; the closed-handler error is `-32000` with HTTP 503.
