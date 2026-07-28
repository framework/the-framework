Provider adapter layer of `@gemstack/ai-sdk` — one module per vendor mapping the SDK's neutral contracts (`ProviderFactory`, `ProviderAdapter`, plus optional capability adapters) onto each vendor's wire protocol; factories are registered into the process-wide `AiRegistry` and resolved from `'provider/model'` strings.

## TLDR

- `anthropic.ts` + `anthropic-stream.ts` — Anthropic Messages API: chat, files, `cache_control` prompt caching, native computer-use/web-search blocks; shared stream-event mapper.
- `bedrock.ts` — AWS Bedrock (Anthropic Claude models only in v1), reuses the `anthropic.ts` converters and stream mapper over `InvokeModel*`.
- `openai/` — full OpenAI suite (chat/embeddings/images/tts/stt/files/vector stores/prompt-cache key); `openai.ts` is the compat barrel.
- `google/` — Gemini suite (chat/embeddings/images/files/FileSearchStores); `google.ts` is the compat barrel; `google-cache-registry.ts` owns the cacheKey → `cachedContents/*` resource map for Gemini explicit caching.
- `openai-compatible.ts` — class-factory for name+baseURL-only OpenAI-protocol rebrands; used by `azure.ts`, `deepseek.ts`, `groq.ts`, `ollama.ts`, `xai.ts`.
- `mistral.ts`, `openrouter.ts` — hand-written OpenAI-compatible providers (add embeddings / analytics headers respectively).
- `cohere.ts`, `jina.ts`, `voyage.ts` — embeddings+reranking-only providers; `elevenlabs.ts` — TTS+STT-only. All four throw from `create()` (no chat).
- `lazy-client.ts` — memoised lazy SDK-client helper with the `.set()` test seam.
- `client-construction.test.ts` — the only tests driving the real dynamic SDK imports (OpenAI + Google).

## Decisions

- Every vendor SDK is a dynamic import behind `lazyClient` — all SDKs stay optional dependencies paid only on first use; small REST surfaces (Jina, Voyage, ElevenLabs, Mistral/OpenAI embeddings, Imagen) use raw `fetch` with no SDK at all.
- Capability methods (`createEmbedding`/`createReranking`/`createImage`/`createTts`/`createStt`/`createFiles`/`createVectorStores`) are optional on `ProviderFactory`; `AiRegistry` throws descriptive errors naming capable providers when a capability is missing.
- `ToolDefinitionSchema.providerHint` selects provider-native tool blocks (computer-use, web-search, file-search) over generic function-call wrapping; adapters ignore unrecognized hint types and fall back to function schemas.
- Prompt caching follows each provider's idiom behind the one neutral `CacheableMarkers` shape: Anthropic `cache_control` breakpoint markers, OpenAI `prompt_cache_key` routing hint, Google explicit `cachedContents` resources via the registry.

## Facts

- Usage is always normalized to `{promptTokens, completionTokens, totalTokens}` and finish reasons to `'stop' | 'length' | 'content_filter' | 'tool_calls'`; getting complete usage out of *streamed* calls is a recurring per-provider problem (Anthropic split events, OpenAI `include_usage` + trailing empty-choices chunk).
- Error messages are uniformly prefixed `[ai-sdk]`.
- `mistral.ts`, `openrouter.ts`, and `openai-compatible.ts` import `OpenAIAdapter` through the `./openai.js` barrel.
