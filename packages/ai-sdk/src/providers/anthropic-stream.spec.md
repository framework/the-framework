Maps decoded Anthropic stream events to neutral `StreamChunk`s, with cross-event state so streamed usage comes out complete; shared by the native Anthropic adapter and Bedrock.

## TLDR

- `mapAnthropicStreamEvent(event, state)` generator: `content_block_delta` → `text-delta` / `tool-call-delta` (partial JSON), `content_block_start` (tool_use) → `tool-call-delta` carrying `{id, name}`, `message_delta` → `finish`, `message_start` → `usage`.
- `AnthropicStreamState` (`newAnthropicStreamState()`) carries `lastPromptTokens` between events; the state object is mutated across calls.

## Problems

- The Anthropic protocol splits token counts across two events: prompt tokens arrive on `message_start`, completion tokens on `message_delta`. Without stitching them, the `finish` chunk would report `promptTokens: 0`, the agent loop's last-wins usage aggregation would overwrite the correct earlier value, and billing/`withBudget` would silently undercharge streamed calls.

## Facts

- `output_tokens` on `message_start` is the SDK's initial counter (~0/1), not the final total — the early `usage` chunk deliberately claims `completionTokens: 0`; the `finish` chunk carries the authoritative usage.
- Bedrock wraps Anthropic's stream events 1:1 in `chunk.bytes`, which is why this mapper lives in its own module (imported by both `anthropic.ts` and `bedrock.ts`).
- `delta.stop_reason === 'tool_use'` maps to finishReason `'tool_calls'`, everything else to `'stop'`.
