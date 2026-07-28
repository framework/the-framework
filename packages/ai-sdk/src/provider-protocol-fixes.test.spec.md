Tests for provider adapter protocol edge cases: Google prompt-cache payload shape, Gemini/OpenAI streaming finish reasons, Anthropic system flattening, and OpenAI stream usage opt-in.

## TLDR

- Google cache: with `cache: {messages: 1}` only the cached region moves into the `cachedContent` resource — the system instruction and tools must still be sent on the wire.
- Gemini finish reasons: a function-call turn (which Gemini labels `STOP`) must map to `tool_calls` or the loop never sends tool results back; a `SAFETY` stop maps to `content_filter`, never `tool_calls`.
- Anthropic `splitSystemMessages` flattens `ContentPart[]` system content to text (no `"[object Object]"`).
- OpenAI streaming: adapter sets `stream_options: {include_usage: true}` (without it OpenAI never sends usage for streamed calls) and reads usage from the trailing zero-choices chunk; `finish_reason: 'length'` is reported as `length`, not a clean stop.

## Facts

- Adapters expose a `getClient.set(...)` test seam so a scripted client double replaces the real SDK — payload capture without network.
