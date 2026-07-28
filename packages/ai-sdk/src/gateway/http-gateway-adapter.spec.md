`HttpGatewayAdapter` — abstract Template Method base normalizing a custom LLM gateway's wire format behind the `ProviderAdapter` contract.

## TLDR

- Base class owns the reusable lifecycle: `fetch` POST, JSON decode, SSE framing (`parseSseStream`), `AbortSignal` wiring, and non-2xx error mapping.
- Subclasses fill four `protected abstract` hooks: `buildHeaders()` (auth), `buildRequestBody(options, ctx)` (request envelope), `parseResponse(json)` (non-streaming → `ProviderResponse`), `parseStreamEvent(event)` (one `SseEvent` → zero or more `StreamChunk`s).
- Overridable extras: `endpoint(ctx)` (defaults to `config.baseUrl` for both paths; branch on `ctx.stream` or append paths), `onErrorResponse(res)` (default reads text body and throws a readable error).

## Decisions

- Explicitly the Laravel custom-driver pattern (Template Method); subclasses register through `AiRegistry.register()` (the framework's `extend()` equivalent).
- Reach for this ONLY when the gateway's wire format matches no built-in provider — an OpenAI/Anthropic-compatible gateway should use a `baseUrl` override on the existing driver, no subclass.

## Facts

- Header precedence (later wins): `content-type`/`accept` defaults < `config.headers` < `buildHeaders()` — auth always wins.
- `accept` is `text/event-stream` on the streaming path, `application/json` otherwise; `GatewayRequestContext.stream` tells hooks which path they're on.
- `stream()` throws if the response has no body; each SSE event may expand to multiple chunks (or none — e.g. keep-alives).
