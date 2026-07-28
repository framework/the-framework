Mistral provider — chat via the reused `OpenAIAdapter` (Mistral's API is OpenAI-compatible) plus a hand-written raw-`fetch` embeddings adapter.

## TLDR

- `MistralProvider` (name `'mistral'`): `create()` builds an `OpenAIAdapter` pointed at `https://api.mistral.ai/v1` (overridable via `baseUrl`); `createEmbedding()` → `MistralEmbeddingAdapter` (POST `{baseUrl}/embeddings`, Bearer auth).
- Hand-written rather than a `defineOpenAiCompatible` one-liner because it adds real behaviour (embeddings) beyond name + base URL.
