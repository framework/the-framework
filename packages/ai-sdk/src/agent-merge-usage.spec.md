Tests for `agent.ts`'s `mergeUsage` — covers MAX-per-field merging of per-step `TokenUsage` snapshots.

## Facts

- Regression suite for the Anthropic / Bedrock-Anthropic streaming bug where `message_start` carries promptTokens and `message_delta` (finish) carries completionTokens with `promptTokens: 0`; naive last-wins overwrote the prompt count and billing silently undercharged.
- MAX per field is safe because each usage chunk is a running snapshot (counts only grow within a step), never a delta.
