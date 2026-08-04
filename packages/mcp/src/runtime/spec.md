The runtime half of `@gemstack/mcp`: wiring declared server classes into the official MCP SDK, plus the HTTP transports and session lifecycle.

## TLDR

- `sdk-server.ts` — builds one SDK `Server` per session and registers all seven request handlers; the tool-call flow is: find → `shouldRegister` gate → validate input → resolve DI deps → `handle()` → consume return → observer emit. Tool errors become `isError` results; resource/prompt errors throw.
- `web-handler.ts` — the Web-standard transport with the session lifecycle (see Decisions).
- `node-handler.ts` — a pure adapter bridging Node's `(req, res)` onto the web handler: reconstructs the URL (`x-forwarded-proto`/`host`, first values only), buffers request bodies, streams responses chunk-by-chunk so SSE stays open.
- `consume-tool-return.ts` — drains a plain promise or an async generator; progress yields become `notifications/progress` only when the caller supplied a `progressToken`, otherwise they are dropped silently (the generator still runs).
- `handle-deps.ts` — DI resolution that never injects `undefined`: three distinct loud errors (no resolver — with the exact fix snippet; resolver threw; resolver returned undefined).

## Decisions

- **Only an `initialize` POST may open a session.** Every other request without a valid session id is rejected *without allocating* — previously any unauthenticated POST built a transport+SDK pair and attached it to the notification fan-out that nothing ever detached (a memory leak an attacker could drive).
- Stateless mode is selected by a **presence check** (`sessionIdGenerator` key present and explicitly `undefined`), and builds one transport+SDK pair *per request* because the SDK rejects reused stateless transports (request-id collisions). The pair is released only when the response body stream ends, so SSE is not cut short.
- Sessions expire after 30 idle minutes (configurable, `0`/`Infinity` disables), swept lazily on each request with an injectable clock.
- stdio attaches without ever detaching — stdio is process-lifetime.

## Facts

- `prompts/list` advertises **every** prompt argument as `required: true`, even optional Zod fields — a known wart.
- Instances are constructed once per `createSdkServer` call, i.e. per session (per request in stateless mode) — that is where DI runs.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
