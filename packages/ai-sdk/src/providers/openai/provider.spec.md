`OpenAIProvider` factory (name `'openai'`) — the fullest capability surface of any provider: chat, embeddings, images, TTS, STT, files, and vector stores.

## TLDR

- `create()` → `OpenAIAdapter`; `createEmbedding` → `OpenAIEmbeddingAdapter`; `createImage` → `OpenAIImageAdapter`; `createTts`/`createStt` → TTS/STT adapters; `createFiles()` → `OpenAIFileAdapter`; `createVectorStores()` → `OpenAIVectorStoreAdapter`. All share one `OpenAIConfig`.
