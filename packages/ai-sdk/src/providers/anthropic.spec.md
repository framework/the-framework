Anthropic provider — chat adapter over the `@anthropic-ai/sdk` Messages API (generate + stream, prompt-cache markers, native tool blocks) plus a Files adapter; its conversion helpers are exported for reuse by Bedrock.

## TLDR

- `AnthropicProvider` (`ProviderFactory`, name `'anthropic'`): `create()` → `AnthropicAdapter`, `createFiles()` → `AnthropicFileAdapter` (upload/list/delete/retrieve).
- SDK resolved via dynamic import behind `lazyClient` so `@anthropic-ai/sdk` stays an optional dependency.
- Exports reused by `bedrock.ts`: `splitSystemMessages`, `toAnthropicMessages`, `toAnthropicTools`, `toAnthropicToolChoice`, `fromAnthropicResponse`, `applyCacheToSystem/Tools/Messages`.
- Streaming delegates event mapping to `mapAnthropicStreamEvent` from `anthropic-stream.ts`.

## Decisions

- All `role:'system'` messages are stripped from the messages array and joined with `\n\n` into the top-level `system` param (Anthropic has no system role in `messages`).
- Assistant `toolCalls` become `tool_use` content blocks; tool results are re-emitted as user messages containing a `tool_result` block. Tool-result content supports three shapes: string, `ContentPart[]` (e.g. computer-use screenshot image blocks), or JSON-stringify fallback.
- `providerHint.type === 'computer-use'` emits Anthropic's native `computer_20250124` block (default 1280×800; variant overridable via hint `tool`) — the model is fine-tuned on the native block, quality is dramatically better than function-call wrapping.
- `providerHint.type === 'web-search'` emits the server-side `web_search_20250305` block (passes through `max_uses`, `allowed_domains`, `blocked_domains`, `user_location`) — Anthropic runs the search, no agent-loop round-trip.
- `toolChoice 'none'` maps to `undefined` (param omitted); `'required'` → `{type:'any'}`; named tool → `{type:'tool', name}`.
- PDFs are sent as `document` blocks; non-PDF document parts are base64-decoded and sent as text.
- `max_tokens` defaults to 4096 (the param is mandatory on the Anthropic API).

## Facts

- Prompt caching uses `cache_control: {type:'ephemeral'}` on the *last* block of each region to cache; everything up to and including that block is cached. API allows 4 breakpoints; at most 3 are emitted (system, last tool, message N−1) so the limit is never hit.
- `cache.messages = N` marks the last content block of message index N−1 (clamped to the last message); string content is converted to a single text block to carry the marker, same for string-form `system`.
- `fromAnthropicResponse` concatenates all `text` blocks and collects `tool_use` blocks; `stop_reason 'tool_use'` → finishReason `'tool_calls'`.
- File `retrieve()` always reports `mimeType: 'application/octet-stream'`; upload purpose defaults to `'assistants'`.

## Flows

- generate: `splitSystemMessages()` → `toAnthropicMessages()` + `applyCacheTo*()` → `client.messages.create(params, {signal})` → `fromAnthropicResponse()`.
- stream: same param build (+`stream: true`) → `client.messages.stream()` → per event `mapAnthropicStreamEvent(event, state)` yields chunks.
