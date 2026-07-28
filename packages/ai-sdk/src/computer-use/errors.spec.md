Error classes and the Anthropic-model classifier for the computer-use tool (#A7 Phase 2).

## TLDR

- `ComputerUseProviderError` (`code: 'COMPUTER_USE_PROVIDER_MISMATCH'`) — thrown by `computerUseTool` at construction when `model` isn't Anthropic-family; fails at agent boot before the model can hallucinate tool calls a provider can't execute.
- `ComputerUseLimitError` (`code: 'COMPUTER_USE_LIMIT_EXCEEDED'`) — thrown when the per-run action counter exceeds `maxActions` (default 50); bounds runaway click loops.
- `isAnthropicLikeModel(model)` — true for `anthropic/*` and `bedrock/<region.>?anthropic.*` (covers `us.`/`eu.`/`apac.` cross-region inference profiles); exported for symmetric app-side guards.

## Facts

- Computer-use is Anthropic-only in v1 (plan `docs/plans/2026-05-10-ai-computer-use.md`): other providers lack native computer-use or ship preview-quality versions (OpenAI's `computer_use_preview`).
- OpenRouter-routed Anthropic models (`openrouter/anthropic/*`) are deliberately excluded — OpenRouter goes through the OpenAI SDK, so the native computer-use tool block can never reach Anthropic's API.
