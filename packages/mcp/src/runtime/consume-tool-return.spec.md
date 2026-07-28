Runs a tool's `handle()` return value to completion, forwarding streaming yields to the client as `notifications/progress` messages.

## TLDR

- Type-guards the streaming variant: an object with both `.next` and `Symbol.asyncIterator` methods is an async generator; plain Promises are simply awaited.
- Generator path: iterates manually via `ret.next()`, sends each yield as `{ method: 'notifications/progress', params: { progressToken, ...yield } }` — but only when the request's `_meta` carried a `progressToken` AND the SDK `extra` provides `sendNotification` — and resolves to the generator's final return value.
- Yields with no progressToken are dropped silently; the tool still runs to completion. Errors propagate to the caller's try/catch.

## Facts

- `SdkRequestExtra` is deliberately minimal (`{ sendNotification? }`) — only the slice of the SDK handler `extra` this module needs, which also lets `McpTestClient` fake it without the SDK.
