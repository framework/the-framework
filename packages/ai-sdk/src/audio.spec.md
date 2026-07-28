Fluent builder for text-to-speech generation with provider failover and optional storage.

## TLDR

- `AudioGenerator.of(text)` → chain `.model()`, `.voice()`, `.speed()` (0.25–4.0), `.format()` (`mp3|opus|aac|flac|wav`), `.failover(...models)` → `.generate()` returns `TextToSpeechResult`.
- `generate()` resolves the provider factory via `AiRegistry` and requires it to implement `createTts()` (clear error otherwise); failover iterates via `tryWithFailover` from `registry.ts`.
- `.store(path, storage)` generates then persists bytes through a caller-supplied `StorageAdapter` (`put`), returning the path — no storage package is bundled.
