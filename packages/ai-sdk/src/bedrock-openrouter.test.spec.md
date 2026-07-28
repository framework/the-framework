Tests for `providers/openrouter.ts`, `providers/bedrock.ts`, and `providers/anthropic-stream.ts` — provider wiring and the Anthropic stream-event mapper.

## TLDR

- OpenRouter: reuses `OpenAIAdapter`; model strings split on the first slash only (`openrouter/anthropic/claude-3.5-sonnet`); site info becomes `HTTP-Referer`/`X-Title` default headers; default base URL `https://openrouter.ai/api/v1`, overridable.
- Bedrock: v1 supports only Anthropic Claude model families (clear error otherwise); model ids keep colons + dots intact through registry parsing; `isAnthropicOnBedrock` matches `anthropic.` plus regional inference-profile prefixes (`us.`/`eu.`/`apac.`).
- `mapAnthropicStreamEvent` mapping: `content_block_delta`(text_delta)→`text-delta`, `content_block_start`(tool_use)→`tool-call-delta` with id+name, `input_json_delta`→arg-text `tool-call-delta`, `message_delta`→`finish` (stop_reason `tool_use`→`tool_calls`, `end_turn`→`stop`), `message_start`→`usage` chunk, unknown events→nothing.

## Facts

- Regression (#545 sibling fix): Anthropic splits prompt/completion counts across `message_start`/`message_delta`; the mapper threads `state.lastPromptTokens` into the finish chunk's usage so promptTokens is not reset to 0 (billing/withBudget undercharged before). Bedrock-Anthropic shares the identical protocol and had the identical bug.
