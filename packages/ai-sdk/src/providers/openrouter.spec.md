OpenRouter provider — single-API access to many models over the OpenAI-compatible protocol; reuses `OpenAIAdapter` with base URL `https://openrouter.ai/api/v1` plus optional analytics headers.

## TLDR

- `OpenRouterProvider` (name `'openrouter'`): `create()` builds an `OpenAIAdapter` with `defaultHeaders` — `siteUrl` → `HTTP-Referer`, `siteName` → `X-Title` (shown on OpenRouter's leaderboard / per-app analytics).
- Model strings nest the upstream vendor: `openrouter/anthropic/claude-3.5-sonnet` resolves to model `anthropic/claude-3.5-sonnet`.
- Hand-written rather than `defineOpenAiCompatible` because of the header injection.
