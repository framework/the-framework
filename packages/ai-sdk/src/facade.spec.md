Static `AI` facade — one-line entry points for prompts, anonymous agents, images, audio/TTS, transcription, reranking, files, and embeddings.

## TLDR

- `AI.prompt(input, { model? })` runs an anonymous "You are a helpful assistant." agent; `AI.agent(...)` delegates to the `agent()` factory.
- Thin fluent delegations: `AI.image` → `ImageGenerator.of`, `AI.audio` → `AudioGenerator.of`, `AI.transcribe` → `Transcription.fromBytes`, `AI.rerank` → `Reranker` (builder when no options, one-shot Promise with options), `AI.files(provider?)` → `FileManager.for` (defaults to the default model's provider).
- `AI.embed(input, { model?, cache? })`: resolves the provider's `createEmbedding` (clear error if unsupported), auto-chunks arrays >100 items into 100-item batches and merges embeddings + summed usage; `cache: true` wraps in a `CachedEmbeddingAdapter`.

## Decisions

- Cached embedding adapters are memoized by `<provider>::<model>` key: the earlier `WeakMap` keyed on adapter identity always missed because every `embed()` call constructs a fresh inner adapter, making `{ cache: true }` a silent no-op. The memo is cleared on `AiRegistry.reset()` (via `_onAiRegistryReset`) so tests swapping fakes don't bind a stale inner adapter.
