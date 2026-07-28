Class-factory for providers that speak the OpenAI wire protocol and differ only by name and base URL — `defineOpenAiCompatible(options)` returns a `ProviderFactory` class whose `create()` wraps `OpenAIAdapter`.

## Decisions

- Providers that add real behaviour stay hand-written instead of using this (OpenRouter's analytics headers, Mistral's embeddings); pure rebrands (azure, deepseek, groq, ollama, xai) are one-liners over this factory.
- `defaultApiKey` exists for services that ignore the key but whose SDK still demands one (Ollama); `defaultBaseUrl` omitted means the caller must supply one (Azure).
