`AiFake` — the SDK's testing fake: replaces every registered provider with scriptable in-process adapters covering chat, streaming, embeddings, image, TTS, STT, reranking, and files.

## TLDR

- `AiFake.fake()` resets `AiRegistry`, registers a `__fake__` factory implementing every adapter surface, and sets default model `__fake__/default`; `restore()` just resets the registry (caller re-registers real providers).
- Scripting: `respondWith(text)` (ambient default), `respondWithSequence(steps)` (0-based, one entry per `generate`/`stream` call; each `AiFakeStep` = text/toolCalls/finishReason/usage, finishReason defaulting to `tool_calls` when toolCalls set), `failOnStep(n, err)` (takes precedence over the sequence at that index without consuming the step), plus per-surface stubs (`respondWithImage/Audio/Transcription/Embedding/Ranking/FileUpload`).
- `respondWithFileSearchResults({ text | hits, usage })` scripts a single assistant reply for the hosted file-search path (server-side search, no tool round-trip), formatting hits as `(score) text — source` lines.
- Assertions/recorders: `assertPrompted(predicate)` / `assertNothingPrompted` / `assertImageGenerated` / `assertAudioGenerated` / `assertTranscribed` / `assertEmbedded` / `assertReranked` / `assertFileUploaded`, and `getCalls()` (+ per-surface `get*Calls()`).
- `preventStrayPrompts()`: strict mode — an unscripted prompt throws instead of silently returning the ambient default (which made tests pass despite unasserted extra prompts); only `respondWithSequence` entries count as scripted.

## Facts

- `respondWithSequence` resets the call counter so step indices are relative to that call; registered failures survive it, so call order with `failOnStep` doesn't matter.
- The streaming adapter emits `text-delta` → per-tool-call `tool-call` chunks → a `finish` chunk with usage.
- Usage defaults to all zeros — tests of usage-dependent middleware (e.g. budget) must set `AiFakeStep.usage` explicitly.
- The embed fake cycles `_embedResponse` by index modulo length; `getCalls()` returns copies of the array but the captured `ProviderRequestOptions.messages` are by reference (post-call mutations visible).
