Tests for `client-tools.ts` — covers tool listing/execution against a real in-memory MCP server, streaming progress, and connect-failure cleanup.

## TLDR

- `buildLoopback()` fixture: a real SDK `McpServer` (tools `weather`, `echo_int`, `long_task`) linked to a real `Client` via `InMemoryTransport.createLinkedPair()`.
- Caller-owned-client suite: lists 3 tools, JSON Schema passthrough verified via `toolToSchema()`, text results returned as strings, SDK validation failures surface as `[error]` strings, no `close()` on the handle, `filter` and `namePrefix` options, progress order `[1,2,3]` before the result, `streaming: false` path.
- "Streaming is live" suite uses a hand-rolled fake client whose `callTool` reports progress then blocks on a promise; asserts a tool-update chunk arrives (raced against a 250 ms timer) while the call is still pending, and that a `callTool` rejection propagates out of the generator.
- Connect-failure suite drives `connectOrClose()` directly with stub client/transport counters.

## Facts

- Regression #977: streaming must yield each progress notification while the remote call runs (not replay after settle) — the timer race fails if progress is batched.
- Regression #978: a rejecting `connect()` must close both the client and the transport exactly once, and a `close()` that itself throws must not mask the original connect error.
- Progress notifications reach the server handler via `ctx._meta.progressToken` + `ctx.sendNotification({ method: 'notifications/progress', ... })`; the bridge's `onprogress` only fires when the client supplied a token.
- `runTool`/`runStreamingTool` helpers invoke `tool.execute` the same way the agent loop does (promise vs. async-generator drain).
