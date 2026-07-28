Abstract base class for MCP tools: Zod input schema, optional output schema, a `handle()` that is either a plain promise or a progress-yielding async generator, and optional `shouldRegister()` gating.

## TLDR

- `name()` defaults to kebab-cased class name minus the `Tool` suffix (`SearchUsersTool` → `search-users`); `description()` reads `@Description`.
- `schema()` is required (a `ZodLikeObject`, Zod v3 or v4); `outputSchema?()` optionally advertises the response structure.
- `handle()` returns `McpToolReturn`: `Promise<McpToolResult>` or `AsyncGenerator<McpToolProgress, McpToolResult>` — yields are forwarded as `notifications/progress` only when the client supplied a `progressToken` in request `_meta`; otherwise the tool still runs and yields are dropped silently.
- `shouldRegister?()` returning `false` hides the tool from `tools/list` AND makes `tools/call` return an "unknown tool" error — no direct-call bypass.

## Decisions

- The streaming shape mirrors @gemstack/ai-sdk's streaming-tool pattern: an async generator, deliberately not a "send" callback parameter.
- `shouldRegister` is for static gating (env flags, feature toggles, build mode) — it runs with no arguments; per-request gating (auth-scoped tools) is explicitly tracked as future work.

## Facts

- `McpToolResult.content` supports `{ type: 'text', text }` and `{ type: 'image', data, mimeType }` items; `isError?` marks failed calls.
- `McpToolProgress` = `{ progress, total?, message? }` — `total` lets clients render a progress bar.
