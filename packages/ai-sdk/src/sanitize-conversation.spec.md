`sanitizeConversation(messages)` — pure, idempotent load-boundary repair that enforces the tool-call ⇄ tool-result invariant in both directions so persisted histories replay against any provider.

## TLDR

- Complete tool turn (every declared id answered in the immediately-following tool run): kept, results re-emitted in `toolCalls` order exactly one per call; extra/duplicate/orphan tool messages in that run dropped.
- Dangling turn (any id unanswered): assistant's `toolCalls` stripped, text kept as a plain assistant message (empty ⇒ dropped), partial results dropped.
- Orphan tool result (parent missing or dropped): dropped — any `tool` message reaching top-level scan position is by construction an orphan, since complete turns advance the index past their results.

## Problems

- Anthropic requires every `tool_use` to be followed by matching `tool_result`s; OpenAI-compatible providers (DeepSeek, OpenRouter, Azure) are stricter — a `role:'tool'` must immediately follow its declaring `assistant`+`tool_calls`, else `400 Messages with role 'tool' must be a response to a preceding message with 'tool_calls'`. Crashes/client failures mid-turn leave exactly such malformed graphs in the store.

## Decisions

- Load boundary DROPS incomplete turns, unlike the wire-level normalizer in the provider adapters which SYNTHESIZES stub results: an interrupted turn is abandoned history, and a fake "result missing" message would pollute the model's future context.
- `OrmConversationStore.load()` applies this so persisted histories are replay-safe by default.
